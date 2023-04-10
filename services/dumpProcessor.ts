/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.  */

import fs from "fs-extra";
import _ from "lodash";
import he from "he";
import path from "path";
import { Prisma } from "@prisma/client";
import prisma from "./prisma";
import keys from "../utils/keys";
import macros from "../utils/macros";
import { populateES } from "../scripts/populateES";
import {
  BulkUpsertInput,
  Dump,
  Section,
  TransformFunction,
} from "../types/types";

type Maybe<T> = T | null | undefined;

class DumpProcessor {
  CHUNK_SIZE: number;

  constructor() {
    this.CHUNK_SIZE = 5;
  }

  /**
   * @param termDump object containing all class and section data, normally acquired from scrapers
   * @param profDump object containing all professor data, normally acquired from scrapers
   * @param destroy determines if courses that haven't been updated for the last two days will be removed from the database
   * @param currentTermInfos the term infos for which we have data
   */
  async main({
    termDump = { classes: [], sections: [], subjects: {} },
    profDump = [],
    destroy = false,
    currentTermInfos = null,
  }: Dump): Promise<void> {
    const courseTransforms = {
      class_attributes: this.arrayTransform,
      class_attributes_contents: this.arrayStrTransform,
      class_id: this.strTransform,
      coreqs: this.jsonTransform,
      description: this.strTransform,
      fee_amount: this.intTransform,
      fee_description: this.strTransform,
      host: this.strTransform,
      id: this.strTransform,
      // lastUpdateTime should be updated every time this course is inserted
      last_update_time: () => "now()",
      max_credits: this.intTransform,
      min_credits: this.intTransform,
      name: this.strTransform,
      nupath: this.arrayTransform,
      nupath_contents: this.arrayStrTransform,
      opt_prereqs_for: this.jsonTransform,
      prereqs: this.jsonTransform,
      prereqs_for: this.jsonTransform,
      pretty_url: this.strTransform,
      subject: this.strTransform,
      term_id: this.strTransform,
      url: this.strTransform,
    };

    const courseCols = [
      "class_attributes",
      "class_id",
      "coreqs",
      "description",
      "fee_amount",
      "fee_description",
      "host",
      "id",
      "last_update_time",
      "max_credits",
      "min_credits",
      "name",
      "nupath",
      "opt_prereqs_for",
      "prereqs",
      "prereqs_for",
      "pretty_url",
      "subject",
      "term_id",
      "url",
    ];

    const sectionTransforms = {
      class_hash: this.strTransform,
      class_type: this.strTransform,
      crn: this.strTransform,
      honors: this.boolTransform,
      id: this.strTransform,
      info: this.strTransform,
      last_update_time: () => "now()",
      meetings: this.jsonTransform,
      campus: this.strTransform,
      profs: this.arrayTransform,
      profs_contents: this.arrayStrTransform,
      seats_capacity: this.intTransform,
      seats_remaining: this.intTransform,
      url: this.strTransform,
      wait_capacity: this.intTransform,
      wait_remaining: this.intTransform,
    };

    const sectionCols = [
      "class_hash",
      "class_type",
      "crn",
      "honors",
      "id",
      "info",
      "last_update_time",
      "meetings",
      "campus",
      "profs",
      "seats_capacity",
      "seats_remaining",
      "url",
      "wait_capacity",
      "wait_remaining",
    ];

    const coveredTerms: Set<string> = new Set();

    // We delete all of the professors, and insert anew
    // This gets rid of any stale entries (ie. former employees), since each scrape gets ALL employees (not just current term).
    if (profDump.length > 1) {
      await prisma.professor.deleteMany({});
      await prisma.professor.createMany({
        data: profDump,
      });
      macros.log("DumpProcessor: finished with profs");
    }

    // First, we break the classes into groups of 2000 each. Each group will become 1 query
    const groupedClasses = _.chunk(Object.values(termDump.classes), 2000);

    for (const courses of groupedClasses) {
      await prisma.$executeRawUnsafe(
        this.bulkUpsert(
          "courses",
          courseCols,
          courseTransforms,
          courses.map((c) => this.constituteCourse(c, coveredTerms))
        )
      );
    }

    macros.log("DumpProcessor: finished with courses");

    // FIXME this is a bad hack that will work
    const courseIds: Set<string> = new Set(
      (await prisma.course.findMany({ select: { id: true } })).map(
        (elem) => elem.id
      )
    );
    const processedSections = termDump.sections
      .map((section) => this.constituteSection(section, coveredTerms))
      .filter((s) => courseIds.has(s.classHash));

    // First, we break the sections into groups of 2000 each. Each group will become 1 query
    const groupedSections = _.chunk(processedSections, 2000);

    for (const sections of groupedSections) {
      await prisma.$executeRawUnsafe(
        this.bulkUpsert("sections", sectionCols, sectionTransforms, sections)
      );
    }

    macros.log("DumpProcessor: finished with sections");

    await prisma.course.updateMany({
      where: { id: { in: processedSections.map((s) => s.classHash) } },
      data: { lastUpdateTime: new Date() },
    });

    macros.log("DumpProcessor: finished updating times");

    await Promise.all(
      Object.entries(termDump.subjects).map(([key, value]) => {
        return prisma.subject.upsert({
          where: {
            abbreviation: key,
          },
          create: {
            abbreviation: key,
            description: value as string,
          },
          update: {
            description: value,
          },
        });
      })
    );

    macros.log("DumpProcessor: finished with subjects");

    // Updates the termInfo table - adds/updates current terms, and deletes old terms for which we don't have data
    // (only run if the term infos are non-null)
    if (currentTermInfos) {
      const termInfos = currentTermInfos;
      // This deletes any termID which doesn't have associated course data
      //    For example - if we once had data for a term, but have since deleted it, this would remove that termID from the DB
      await prisma.termInfo.deleteMany({
        where: {
          termId: { notIn: termInfos.map((t) => t.termId) },
        },
      });

      // Upsert new term IDs, along with their names and sub college
      for (const { termId, subCollege, text, active } of termInfos) {
        await prisma.termInfo.upsert({
          where: { termId },
          update: {
            text,
            subCollege,
            active,
          },
          create: {
            termId,
            text,
            subCollege,
            active,
          },
        });
      }

      const termsStr = termInfos
        .map((t) => t.termId)
        .sort()
        .join(", ");
      macros.log(`DumpProcessor: finished with term IDs (${termsStr})`);
    }

    if (destroy) {
      const termsStr = Array.from(coveredTerms).sort().join(", ");
      macros.log(
        `DumpProcessor: destroying old courses and sections for terms (${termsStr})`
      );

      // Delete all courses/sections that haven't been seen for the past two days (ie. no longer exist)
      // Two days ago (in milliseconds)
      const twoDaysAgo = new Date(new Date().getTime() - 48 * 60 * 60 * 1000);

      // Delete old sections
      await prisma.section.deleteMany({
        where: {
          course: {
            termId: { in: Array.from(coveredTerms) },
          },
          lastUpdateTime: { lt: twoDaysAgo },
        },
      });

      // Delete old COURSES
      await prisma.course.deleteMany({
        where: {
          termId: { in: Array.from(coveredTerms) },
          lastUpdateTime: { lt: twoDaysAgo },
        },
      });
    }

    macros.log("DumpProcessor: Finished cleaning up");

    await populateES();
  }

  bulkUpsert(
    tableName: string,
    columnNames: string[],
    valTransforms: Record<string, TransformFunction>,
    vals: BulkUpsertInput[]
  ): string {
    let query = `INSERT INTO ${tableName} (${columnNames.join(",")}) VALUES `;
    query += vals
      .map((val) => {
        return `(${columnNames
          .map((c) =>
            valTransforms[c](val[this.toCamelCase(c)], c, valTransforms)
          )
          .join(",")})`;
      })
      .join(",");

    query += ` ON CONFLICT (id) DO UPDATE SET ${columnNames
      .map((c) => `${c} = excluded.${c}`)
      .join(",")} WHERE ${tableName}.id = excluded.id;`;

    return query;
  }

  strTransform(val: Maybe<string>): string {
    const tempVal = val ? `'${DumpProcessor.escapeSingleQuote(val)}'` : "''";
    return he.decode(tempVal);
  }

  arrayStrTransform(val: Maybe<string>): string {
    return val ? `"${DumpProcessor.escapeSingleQuote(he.decode(val))}"` : "''";
  }

  intTransform(val: Maybe<number>): string {
    return val || val === 0 ? `${val}` : "NULL";
  }

  arrayTransform(
    val: Maybe<unknown[]>,
    kind: string,
    transforms: Record<string, TransformFunction>
  ): string {
    return val && val.length !== 0
      ? `'{${val
          .map((v) =>
            transforms[`${kind}_contents`](v, `${kind}_contents`, transforms)
          )
          .join(",")}}'`
      : "array[]::text[]";
  }

  jsonTransform(val: Maybe<unknown>): string {
    return val ? `'${JSON.stringify(val)}'` : "'{}'";
  }

  boolTransform(val: Maybe<boolean>): string {
    return val ? "TRUE" : "FALSE";
  }

  constituteCourse(
    classInfo: any,
    coveredTerms: Set<string>
  ): Prisma.CourseCreateInput {
    coveredTerms.add(classInfo.termId);

    const additionalProps = {
      id: `${keys.getClassHash(classInfo)}`,
      description: classInfo.desc,
      minCredits: Math.floor(classInfo.minCredits),
      maxCredits: Math.floor(classInfo.maxCredits),
    };

    const correctedQuery = {
      ...classInfo,
      ...additionalProps,
      classAttributes: classInfo.classAttributes || [],
      nupath: classInfo.nupath || [],
    };

    const { desc, ...finalCourse } = correctedQuery;

    return finalCourse;
  }

  constituteSection(
    secInfo: Section,
    coveredTerms: Set<string>
  ): Prisma.SectionCreateInput & { classHash: string } {
    coveredTerms.add(secInfo.termId);
    const additionalProps = {
      id: `${keys.getSectionHash(secInfo)}`,
      classHash: keys.getClassHash(secInfo),
    };
    return _.omit({ ...secInfo, ...additionalProps }, [
      "classId",
      "termId",
      "subject",
      "host",
    ]) as unknown as Prisma.SectionCreateInput & { classHash: string };
  }

  toCamelCase(str: string): string {
    return str.replace(/(_[a-z])/g, (group) =>
      group.toUpperCase().replace("_", "")
    );
  }

  static escapeSingleQuote(str: string): string {
    return str.replace(/'/g, "''");
  }
}

const instance = new DumpProcessor();

/* istanbul ignore next - this is only used for manual testing, we don't need to cover it */
async function fromFile(termFilePath, empFilePath): Promise<void | null> {
  const termExists = await fs.pathExists(termFilePath);
  const empExists = await fs.pathExists(empFilePath);

  if (!termExists || !empExists) {
    macros.error("need to run scrape before indexing");
    return;
  }

  const termDump = await fs.readJson(termFilePath);
  const profDump = await fs.readJson(empFilePath);
  await instance.main({ termDump: termDump, profDump: profDump });
}

/* istanbul ignore next - this is only used for manual testing, we don't need to cover it */
if (require.main === module) {
  // If called directly, attempt to index the dump in public dir
  const termFilePath = path.join(
    macros.PUBLIC_DIR,
    "getTermDump",
    "allTerms.json"
  );
  const empFilePath = path.join(macros.PUBLIC_DIR, "employeeDump.json");
  fromFile(termFilePath, empFilePath).catch(macros.error);
}

export default instance;
