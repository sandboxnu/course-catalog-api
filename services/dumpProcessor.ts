/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.  */

import fs from "fs-extra";
import _ from "lodash";
import path from "path";
import { Prisma, TermInfo } from "@prisma/client";
import prisma from "./prisma";
import keys from "../utils/keys";
import macros from "../utils/macros";
import { populateES } from "../scripts/populateES";
import {
  BackendMeeting,
  Dump,
  Employee,
  MeetingTime,
  Requisite,
  Section,
} from "../types/types";
import { ParsedCourseSR } from "../types/scraperTypes";

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
    await this.saveEmployeesToDatabase(profDump);

    const processedCourses = termDump.classes.map((c) =>
      this.convertCourseToDatabaseFormat(c)
    );
    await this.saveCoursesToDatabase(processedCourses);

    // FIXME this is a bad hack that will work
    // TODO zachar - i'll remove this in a follow-up PR. Bad design, unecessary.
    const courseIds: Set<string> = new Set(
      (await prisma.course.findMany({ select: { id: true } })).map(
        (elem) => elem.id
      )
    );
    const processedSections = termDump.sections
      .map((section) => this.convertSectionToDatabaseFormat(section))
      .filter((s) => courseIds.has(s.classHash));
    await this.saveSectionsToDatabase(processedSections);

    await this.saveSubjectsToDatabase(termDump.subjects);

    await this.saveTermInfosToDatabase(currentTermInfos);

    if (destroy) {
      const termsToClean = new Set<string>(
        termDump.sections.map((section) => section.termId)
      );
      await this.destroyOutdatedData(termsToClean);
    }

    await populateES();
  }

  /**
   * If given a non-zero number of employees, delete all existing employee data
   * and save the given data to the database.
   *
   * This gets rid of any stale entries (ie. former employees)
   */
  async saveEmployeesToDatabase(employees: Employee[]): Promise<void> {
    if (employees.length > 0) {
      await prisma.professor.deleteMany({});
      await prisma.professor.createMany({
        data: employees,
      });
      macros.log("Finished with employees");
    }
  }

  /**
   * Saves all course data to the database. This does NOT delete existing courses, but will
   * overwrite the data if there is any new data for those courses.
   *
   * Performs a SQL upsert - insert if the course doesn't exist, update if it does.
   */
  async saveCoursesToDatabase(
    courses: Prisma.CourseCreateInput[]
  ): Promise<void> {
    // Break the classes into groups of 2,000 each. Each group will be processed in parallel
    // We can't process ALL classes in parallel because this may overwhelm the DB
    const groupedCourses = _.chunk(courses, 2000);
    const updateTime = new Date();

    for (const courses of groupedCourses) {
      const upsertQueries = courses.map((course) => {
        course.lastUpdateTime = updateTime;
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

    macros.log("Finished with courses");
  }

  /**
   * Saves all section data to the database. This does NOT delete existing sections, but will
   * overwrite the data if there is any new data for those sections.
   *
   * Performs a SQL upsert - insert if the section doesn't exist, update if it does.
   */
  async saveSectionsToDatabase(
    sections: Prisma.SectionUncheckedCreateInput[]
  ): Promise<void> {
    const updateTime = new Date();

    // Break the sections into groups of 2,000 each. Each group will be processed in parallel
    // We can't process ALL sections in parallel because this may overwhelm the DB
    const groupedSections = _.chunk(sections, 2000);

    for (const sections of groupedSections) {
      const upsertQueries = sections.map((prismaSection) => {
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

    macros.log("Finished with sections");
    await this.updateSectionLastUpdateTime(sections);
  }

  /**
   * Update the lastUpdateTime attribute on all given sections.
   * We use this to track sections that haven't been updated in a while,
   * which means that they're no longer on Banner & should be removed from our database.
   */
  async updateSectionLastUpdateTime(
    sections: Prisma.SectionUncheckedCreateInput[]
  ): Promise<void> {
    await prisma.course.updateMany({
      where: { id: { in: sections.map((s) => s.classHash) } },
      data: { lastUpdateTime: new Date() },
    });

    macros.log("Finished updating times");
  }

  /**
   * Saves all subject data to the database. This does NOT delete existing subjects, but will
   * overwrite the data if there is any new data for those subjects.
   *
   * Performs a SQL upsert - insert if the subject doesn't exist, update if it does.
   */
  async saveSubjectsToDatabase(
    subjects: Record<string, string>
  ): Promise<void> {
    await Promise.all(
      Object.entries(subjects).map(([key, value]) => {
        return prisma.subject.upsert({
          where: {
            abbreviation: key,
          },
          create: {
            abbreviation: key,
            description: value,
          },
          update: {
            description: value,
          },
        });
      })
    );

    macros.log("Finished with subjects");
  }

  /**
   * Updates the termInfo table - adds/updates current terms, and deletes old terms for which we don't have data
   */
  async saveTermInfosToDatabase(termInfos: TermInfo[] | null): Promise<void> {
    if (termInfos !== null) {
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
      macros.log(`Finished with term IDs (${termsStr})`);
    }
  }

  /**
   * Destroys sections and courses which haven't been updated in over two days.
   * This indicates that the data no longer exists in Banner - the course/section has been removed.
   *
   * This should be run AFTER each updater/scraper run (ie. don't delete the courses we've just scraped)
   */
  async destroyOutdatedData(termsToClean: Set<string>): Promise<void> {
    const termsStr = Array.from(termsToClean).sort().join(", ");
    macros.log(`Destroying old courses and sections for terms (${termsStr})`);

    // Delete all courses/sections that haven't been seen for the past two days (ie. no longer exist)
    // Two days ago (in milliseconds)
    const twoDaysAgo = new Date(new Date().getTime() - 48 * 60 * 60 * 1000);

    // Delete old sections
    await prisma.section.deleteMany({
      where: {
        course: {
          termId: { in: Array.from(termsToClean) },
        },
        lastUpdateTime: { lt: twoDaysAgo },
      },
    });

    // Delete old COURSES
    await prisma.course.deleteMany({
      where: {
        termId: { in: Array.from(termsToClean) },
        lastUpdateTime: { lt: twoDaysAgo },
      },
    });
  }

  /**
   * Converts a {@link Requisite} to a format compatible with Prisma.
   *
   * Currently, this function does little. It's essentially a way to tell Typescript, "yeah, they're the same types".
   * However, this is useful because it allows us to easily change the format of the requisite in the future.
   */
  private convertRequisiteToDatabaseFormat(
    req: Requisite
  ): Prisma.InputJsonValue {
    if (typeof req === "string") {
      return req;
    } else if ("classId" in req) {
      return req;
    } else {
      return {
        ...req,
        values: req.values.map((val) =>
          this.convertRequisiteToDatabaseFormat(val)
        ),
      };
    }
  }

  /**
   * Converts an optional {@link Requisite} to a format compatible with Prisma.
   */
  private convertRequisiteToNullableDatabaseFormat(
    req: Requisite | undefined
  ): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
    if (req === undefined) {
      return Prisma.DbNull;
    }

    return this.convertRequisiteToDatabaseFormat(req);
  }

  /**
   * Converts an array of {@link Requisite}s to a format compatible with Prisma.
   */
  private convertRequisitesToNullableDatabaseFormat(
    reqs?: Requisite[]
  ): Prisma.InputJsonArray {
    if (reqs === undefined) {
      return [];
    }

    return reqs.map((val) => this.convertRequisiteToDatabaseFormat(val));
  }

  /**
   * Converts one of our course types to a type compatible with the format required by Prisma.
   * The converted course is ready for insertion to our database.
   */
  convertCourseToDatabaseFormat(
    classInfo: ParsedCourseSR
  ): Prisma.CourseCreateInput {
    return {
      ...classInfo,
      id: keys.getClassHash(classInfo),
      description: classInfo.desc,
      minCredits: Math.floor(classInfo.minCredits),
      maxCredits: Math.floor(classInfo.maxCredits),
      prereqs: this.convertRequisiteToNullableDatabaseFormat(classInfo.prereqs),
      coreqs: this.convertRequisiteToNullableDatabaseFormat(classInfo.coreqs),
      optPrereqsFor: this.convertRequisitesToNullableDatabaseFormat(
        classInfo.optPrereqsFor.values
      ),
      prereqsFor: this.convertRequisitesToNullableDatabaseFormat(
        classInfo.prereqsFor.values
      ),
      lastUpdateTime: new Date(classInfo.lastUpdateTime),
    };
  }

  /**
   * Converts a {@link MeetingTime} to a format compatible with Prisma.
   *
   * This doesn't do much at the moment, but it's useful for future-proofing.
   */
  private convertMeetingTimeToDatabaseFormat(
    meeting: MeetingTime
  ): Prisma.InputJsonObject {
    return { ...meeting };
  }

  /**
   * Converts a single {@link BackendMeeting} to a format compatible with Prisma.
   */
  private convertBackendMeetingToDatabaseFormat(
    meeting: BackendMeeting
  ): Prisma.InputJsonObject {
    // Essentially, this takes a object with keys and values, and replaces every value with fn(value).
    // That `fn`, in this case, is the `convertMeetingTimeToDatabaseFormat` function.
    const times: Prisma.InputJsonObject = Object.fromEntries(
      // `entries` takes an object and converts it to an array of [key, value] pairs.
      // `fromEntries` does the opposite
      // So, we convert to entries, transform the values, then convert back to an object
      Object.entries(meeting.times).map(([key, val]) => {
        return [
          key,
          val.map((v) => this.convertMeetingTimeToDatabaseFormat(v)),
        ];
      })
    );
    return { ...meeting, times };
  }

  /**
   * Converts a {@link BackendMeeting} array to a format compatible with Prisma.
   */
  private convertBackendMeetingsToDatabaseFormat(
    meetings?: BackendMeeting[]
  ): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
    if (meetings === undefined) {
      return Prisma.DbNull;
    }

    return meetings.map((val) =>
      this.convertBackendMeetingToDatabaseFormat(val)
    );
  }

  /**
   * Converts one of our section types to a type compatible with the format required by Prisma.
   * The converted section is ready for insertion to our database.
   */
  convertSectionToDatabaseFormat(
    secInfo: Section
  ): Prisma.SectionUncheckedCreateInput {
    return {
      ...secInfo,
      id: `${keys.getSectionHash(secInfo)}`,
      classHash: keys.getClassHash(secInfo),
      meetings: this.convertBackendMeetingsToDatabaseFormat(secInfo.meetings),
      lastUpdateTime: new Date(secInfo.lastUpdateTime),
    };
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
