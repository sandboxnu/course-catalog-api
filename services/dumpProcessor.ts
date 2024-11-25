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
  Dump,
  Employee,
  Section,
  convertSectionToPrismaType,
} from "../types/types";
import { convertCourseToPrismaType } from "../types/scraperTypes";

class DumpProcessor {
  /**
   * @param termDump object containing all class and section data, normally acquired from scrapers
   * @param profDump object containing all professor data, normally acquired from scrapers
   * @param destroy determines if courses that haven't been updated for the last two days will be removed from the database
   * @param allTermInfos Every {@link TermInfo} we know about, even if we don't have data for them
   */
  async main({
    termDump = { classes: [], sections: [], subjects: {} },
    profDump = [],
    deleteOutdatedData = false,
    allTermInfos = null,
  }: Dump): Promise<void> {
    await this.saveEmployeesToDatabase(profDump);

    const processedCourses = termDump.classes.map((c) =>
      convertCourseToPrismaType(c),
    );
    await this.saveCoursesToDatabase(processedCourses);

    const processedSections = termDump.sections.map((section) =>
      convertSectionToPrismaType(section),
    );
    await this.saveSectionsToDatabase(processedSections);

    await this.saveSubjectsToDatabase(termDump.subjects);

    await this.saveTermInfosToDatabase(allTermInfos);

    if (deleteOutdatedData) {
      // We only want to delete outdated data for the term IDs we're currently updating
      // eg. we don't want to touch older, archived terms which aren't being updated
      //    (since they haven't been updated in a while)
      const termsWithSections = termDump.sections.map((s) => s.termId);
      const termsWithCourses = termDump.classes.map((c) => c.termId);

      const termsToClean = new Set<string>(
        termsWithSections.concat(termsWithCourses),
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
    courses: Prisma.CourseCreateInput[],
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
    sections: Prisma.SectionCreateInput[],
  ): Promise<void> {
    const updateTime = new Date();

    // Break the sections into groups of 2,000 each. Each group will be processed in parallel
    // We can't process ALL sections in parallel because this may overwhelm the DB
    const groupedSections = _.chunk(sections, 2000);

    for (const sections of groupedSections) {
      const upsertQueries = sections.map((prismaSection) => {
        // Updates thelast update time for tracking sections that haven't been updated
        // in a while for eventual removal
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
  }

  /**
   * Saves all subject data to the database. This does NOT delete existing subjects, but will
   * overwrite the data if there is any new data for those subjects.
   *
   * Performs a SQL upsert - insert if the subject doesn't exist, update if it does.
   */
  async saveSubjectsToDatabase(
    subjects: Record<string, string>,
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
      }),
    );

    macros.log("Finished with subjects");
  }

  /**
   * Returns only those term IDs which currently have related data in the database.
   *
   * Related data (for the most part) means a section/course in that term.
   */
  async getTermIdsWithData(): Promise<string[]> {
    // Get a list of termIDs (not termInfos!!) for which we already have data
    const termIdsWithData = await prisma.course.groupBy({ by: ["termId"] });

    return termIdsWithData.map((t) => t.termId);
  }

  /**
   * Given a list of {@link TermInfo}s, add/update all {@link TermInfo}s which already have
   * data in the database (as determined by {@link DumpProcessor.getTermIdsWithData})
   *
   * ie. Only save/update those {@link TermInfo}s for which we have class/section data already saved.
   */
  async saveTermInfosToDatabase(termInfos: TermInfo[] | null): Promise<void> {
    if (termInfos === null) {
      return;
    }

    const termIdsWithData = await this.getTermIdsWithData();

    const termInfosWithData = termInfos.filter((t) =>
      termIdsWithData.includes(t.termId),
    );

    // Upsert new term IDs, along with their names, sub college, and active status
    for (const { termId, subCollege, text, active } of termInfosWithData) {
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

    const termsStr = termInfosWithData
      .map((t) => t.termId)
      .sort()
      .join(", ");
    macros.log(`Finished with term IDs (${termsStr})`);
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

    // This deletes any termID which doesn't have associated course data
    //    For example - if we once had data for a term, but have since deleted it, this would remove that termID from the DB
    await prisma.termInfo.deleteMany({
      where: {
        termId: { notIn: await this.getTermIdsWithData() },
      },
    });
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
    "allTerms.json",
  );
  const empFilePath = path.join(macros.PUBLIC_DIR, "employeeDump.json");
  fromFile(termFilePath, empFilePath).catch(macros.error);
}

export default instance;
