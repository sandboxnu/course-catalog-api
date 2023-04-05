/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.  */

import fs from "fs-extra";
import _ from "lodash";
import path from "path";
import { Prisma } from "@prisma/client";
import prisma from "./prisma";
import keys from "../utils/keys";
import macros from "../utils/macros";
import { populateES } from "../scripts/populateES";
import { Dump, Section } from "../types/types";

class DumpProcessor {
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
    // TODO remove this
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

    const processedCourses = termDump.classes.map((c) =>
      this.constituteCourse(c, coveredTerms)
    );
    // Break the classes into groups of 2,000 each. Each group will be processed in parallel
    // We can't process ALL classes in parallel because this may overwhelm the DB
    const groupedCourses = _.chunk(processedCourses, 2000);

    for (const courses of groupedCourses) {
      const upsertQueries = courses.map((course) => {
        return prisma.course.upsert({
          create: course,
          update: course,
          where: {
            id: course.id,
          },
        });
      });

      // Execute in parallel
      await Promise.all(upsertQueries);
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

    // Break the sections into groups of 2,000 each. Each group will be processed in parallel
    // We can't process ALL sections in parallel because this may overwhelm the DB
    const groupedSections = _.chunk(processedSections, 2000);
    const updateTime = new Date();

    for (const sections of groupedSections) {
      const upsertQueries = sections.map((section) => {
        // Our type has a 'classHash', but Prisma doesn't & we have to remove it
        const { classHash: _classHash, ...prismaSection } = section;
        prismaSection.lastUpdateTime = updateTime;
        return prisma.section.upsert({
          create: prismaSection,
          update: prismaSection,
          where: {
            id: prismaSection.id,
          },
        });
      });

      // Execute in parallel
      await Promise.all(upsertQueries);
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
      for (const { termId, subCollege, text } of termInfos) {
        await prisma.termInfo.upsert({
          where: { termId },
          update: {
            text,
            subCollege,
          },
          create: {
            termId,
            text,
            subCollege,
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
