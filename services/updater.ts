/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import pMap from "p-map";
import { Course, Section, User } from "@prisma/client";

import macros from "../utils/macros";
import prisma from "./prisma";
import keys from "../utils/keys";
import dumpProcessor from "./dumpProcessor";
import termParser from "../scrapers/classes/parsersxe/termParser";
import { Section as ScrapedSection } from "../types/types";
import { sendNotifications } from "./notifyer";
import { NotificationInfo } from "../types/notifTypes";

import { NUMBER_OF_TERMS_TO_UPDATE } from "../scrapers/classes/parsersxe/bannerv9Parser";

const FAULTY_TERM_IDS = ["202225"];

// ======= TYPES ======== //
// A collection of structs for simpler querying of pre-scrape data
interface OldData {
  watchedSectionLookup: Record<string, Section>;
  watchedCourseLookup: Record<string, Course>;
  oldSectionsByClass: Record<string, string[]>;
}

// the types of models/records that a user can follow
type ModelName = "course" | "section";

class Updater {
  COURSE_MODEL: ModelName;
  SECTION_MODEL: ModelName;
  SEMS_TO_UPDATE: string[];

  // produce a new Updater instance
  static async create(): Promise<Updater> {
    // Get term IDs from our database
    const termInfos = await prisma.termInfo.findMany({
      orderBy: { termId: "desc" },
      take: NUMBER_OF_TERMS_TO_UPDATE,
    });

    const termIds: string[] = termInfos.map((t) => t.termId);

    return new this(termIds);
  }

  // The constructor should never be directly called - use .create()
  // HOWEVER, it's called directly for testing purposes - don't make this method private
  constructor(termIds: string[]) {
    this.COURSE_MODEL = "course";
    this.SECTION_MODEL = "section";
    this.SEMS_TO_UPDATE = Updater.filterTermIds(termIds);
  }

  /**
   * Filters the Banner term IDs that are given.
   * Some terms (specifically, 202225) exist in Banner - but not fully.
   * So, we get this term ID from the Banner endpoint which lists term IDs, but
   * this will throw an error eventually (since this term has no sections associated with it in Banner).
   */
  static filterTermIds(termIds: string[]): string[] {
    return termIds.filter((t) => !FAULTY_TERM_IDS.includes(t));
  }

  // TODO must call this in server
  start(): void {
    // 5 min if prod, 30 sec if dev.
    // In dev the cache will be used so we are not actually hitting NEU's servers anyway.
    const intervalTime = macros.PROD ? 300000 : 30000;

    // Flag only used for testing, since we only need the updater to run once
    if (!process.env.UPDATE_ONLY_ONCE) {
      setInterval(async () => {
        await this.updateOrExit();
      }, intervalTime);
    }

    this.updateOrExit();
  }

  async updateOrExit(): Promise<void> {
    try {
      await this.update();
    } catch (e) {
      macros.warn("Updater failed with: ", e);
      process.exit(1); // if updater fails, exit the process so we can spin up a new task and not hang
    }
  }

  // Update classes and sections users and notify users if seats have opened up
  async update(): Promise<void> {
    macros.log(`Updating terms: ${this.SEMS_TO_UPDATE.join(", ")}`);

    const startTime = Date.now();

    // scrape everything
    const sections: ScrapedSection[] = (
      await pMap(this.SEMS_TO_UPDATE, (termId) => {
        return termParser.parseSections(termId);
      })
    ).reduce((acc, val) => acc.concat(val), []);

    macros.log(`scraped ${sections.length} sections`);
    const notificationInfo = await this.getNotificationInfo(sections);
    const courseHashToUsers: Record<string, User[]> = await this.modelToUser(
      this.COURSE_MODEL
    );
    const sectionHashToUsers: Record<string, User[]> = await this.modelToUser(
      this.SECTION_MODEL
    );

    const dumpProcessorStartTime = Date.now();
    macros.log("Running dump processor");

    await dumpProcessor.main({
      termDump: { sections, classes: [], subjects: {} },
      destroy: true,
    });

    macros.log(
      `finished running dump processor in ${
        Date.now() - dumpProcessorStartTime
      } ms.`
    );
    const totalTime = Date.now() - startTime;

    await sendNotifications(
      notificationInfo,
      courseHashToUsers,
      sectionHashToUsers
    );

    macros.log(
      `${
        "Done running updater onInterval".underline.green
      }. It took ${totalTime} ms (${(totalTime / 60000).toFixed(
        2
      )} minutes). Updated ${sections.length} sections.`
    );
  }

  async getNotificationInfo(
    sections: ScrapedSection[]
  ): Promise<NotificationInfo> {
    const { watchedCourseLookup, watchedSectionLookup, oldSectionsByClass } =
      await this.getOldData();

    const newSectionsByClass: Record<string, string[]> = {};

    // map of courseHash to newly scraped sections
    for (const s of sections) {
      const hash: string = keys.getClassHash(s);
      if (!newSectionsByClass[hash]) newSectionsByClass[hash] = [];
      newSectionsByClass[hash].push(keys.getSectionHash(s));
    }

    const notificationInfo: NotificationInfo = {
      updatedCourses: [],
      updatedSections: [],
    };

    // find watched courses with added sections and add to notificationInfo
    Object.entries(newSectionsByClass).forEach(([classHash, sectionHashes]) => {
      if (!oldSectionsByClass[classHash] || !watchedCourseLookup[classHash]) {
        return;
      }
      const newSectionCount = sectionHashes.filter(
        (hash: string) => !oldSectionsByClass[classHash].includes(hash)
      ).length;
      if (newSectionCount > 0) {
        const { id, subject, classId, termId } = watchedCourseLookup[classHash];

        notificationInfo.updatedCourses.push({
          termId,
          subject,
          courseId: classId,
          courseHash: id,
          campus: Updater.getCampusFromTerm(termId),
          numberOfSectionsAdded: newSectionCount,
        });
      }
    });

    // find watched sections with more seats or waitlist spots and add to notificationInfo
    sections.forEach((s: ScrapedSection) => {
      const sectionId = keys.getSectionHash(s);
      const oldSection = watchedSectionLookup[sectionId];
      if (!oldSection) return;

      if (
        (s.seatsRemaining > 0 && oldSection.seatsRemaining <= 0) ||
        (s.waitRemaining > 0 && oldSection.waitRemaining <= 0)
      ) {
        const { termId, subject, classId } = keys.parseSectionHash(sectionId);

        notificationInfo.updatedSections.push({
          termId,
          subject,
          courseId: classId,
          crn: s.crn,
          sectionHash: sectionId,
          campus: Updater.getCampusFromTerm(termId),
          seatsRemaining: s.seatsRemaining,
        });
      }
    });
    return notificationInfo;
  }

  // return a collection of data structures used for simplified querying of data
  async getOldData(): Promise<OldData> {
    const watchedCoursesTerms = [];

    for (const termId of this.SEMS_TO_UPDATE) {
      watchedCoursesTerms.push(
        await prisma.followedCourse.findMany({
          include: { course: true },
          where: { course: { termId } },
        })
      );
    }
    const watchedCourses = watchedCoursesTerms.reduce(
      (acc, val) => acc.concat(val),
      []
    );

    const watchedCourseLookup: Record<string, Course> = {};
    for (const s of watchedCourses) {
      watchedCourseLookup[s.courseHash] = s.course;
    }

    const watchedSections = (
      await pMap(this.SEMS_TO_UPDATE, (termId) => {
        return prisma.followedSection.findMany({
          include: { section: { include: { course: true } } },
          where: { section: { course: { termId } } },
        });
      })
    ).reduce((acc, val) => acc.concat(val), []);

    const watchedSectionLookup: Record<string, Section> = {};
    for (const s of watchedSections) {
      watchedSectionLookup[s.sectionHash] = s.section;
    }

    const oldSections: Section[] = (
      await pMap(this.SEMS_TO_UPDATE, (termId) => {
        return prisma.section.findMany({
          where: { course: { termId } },
        });
      })
    ).reduce((acc, val) => acc.concat(val), []);

    const oldSectionsByClass: Record<string, string[]> = {};
    for (const s of oldSections) {
      if (!(s.classHash in oldSectionsByClass)) {
        oldSectionsByClass[s.classHash] = [];
      }
      oldSectionsByClass[s.classHash].push(s.id);
    }

    return {
      watchedCourseLookup,
      watchedSectionLookup,
      oldSectionsByClass,
    };
  }

  static getCampusFromTerm(term: string): string {
    switch (term[5]) {
      case "2":
      case "8":
        return "LAW";
      case "4":
      case "5":
        return "CPS";
      default:
        return "NEU";
    }
  }

  // Return an Object of the list of users associated with what class or section they are following
  async modelToUser(modelName: ModelName): Promise<Record<string, User[]>> {
    const columnName = `${modelName}_hash`;
    const pluralName = `${modelName}s`;
    const dbResults: Record<string, any>[] = await prisma.$queryRawUnsafe(
      `SELECT ${columnName}, JSON_AGG(JSON_BUILD_OBJECT('id', id, 'phoneNumber', phone_number)) FROM followed_${pluralName} JOIN users on users.id = followed_${pluralName}.user_id GROUP BY ${columnName}`
    );

    return Object.assign(
      {},
      ...dbResults.map((res) => ({ [res[columnName]]: res.json_agg }))
    );
  }
}

if (require.main === module) {
  Updater.create()
    .then((updater) => {
      updater.start();
      return null;
    })
    .catch((msg) => macros.log(msg));
}

export default Updater;
