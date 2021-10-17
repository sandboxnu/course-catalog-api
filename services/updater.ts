/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import _ from "lodash";
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

import bannerv9Parser from "../scrapers/classes/parsersxe/bannerv9Parser";
import bannerv9CollegeUrls from "../scrapers/classes/bannerv9CollegeUrls";

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
  // produce a new Updater instance
  COURSE_MODEL: ModelName;

  SECTION_MODEL: ModelName;

  SEMS_TO_UPDATE: string[];

  static async create() {
    macros.log("1");
    // Scrapes a list of terms IDs from Banner - these are the only ones we want to update
    const termIds: string[] = await bannerv9Parser.getTermList(
      bannerv9CollegeUrls[0]
    );
    macros.log("2");
    return new this(termIds);
  }

  // DO NOT call the constructor, instead use .create
  constructor(termIds: string[]) {
    this.COURSE_MODEL = "course";
    this.SECTION_MODEL = "section";
    this.SEMS_TO_UPDATE = termIds;
  }

  // TODO must call this in server
  async start() {
    // 5 min if prod, 30 sec if dev.
    // In dev the cache will be used so we are not actually hitting NEU's servers anyway.
    const intervalTime = macros.PROD ? 300000 : 30000;

    setInterval(() => {
      try {
        this.update();
      } catch (e) {
        macros.warn("Updater failed with: ", e);
      }
    }, intervalTime);
    this.update();
  }

  // Update classes and sections users and notify users if seats have opened up
  async update() {
    macros.log("updating");

    const startTime = Date.now();

    // scrape everything
    const sections: ScrapedSection[] = (
      await pMap(this.SEMS_TO_UPDATE, (termId) => {
        return termParser.parseSections(termId);
      })
    ).flat();

    const notificationInfo = await this.getNotificationInfo(sections);
    const courseHashToUsers: Record<string, User[]> = await this.modelToUser(
      this.COURSE_MODEL
    );
    const sectionHashToUsers: Record<string, User[]> = await this.modelToUser(
      this.SECTION_MODEL
    );

    await dumpProcessor.main({
      termDump: { sections, classes: {}, subjects: {} },
      destroy: true,
    });

    const totalTime = Date.now() - startTime;

    await sendNotifications(
      notificationInfo,
      courseHashToUsers,
      sectionHashToUsers
    );

    macros.log(
      `Done running updater onInterval. It took ${totalTime} ms. Updated ${sections.length} sections.`
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
    const watchedCourses = (
      await pMap(this.SEMS_TO_UPDATE, (termId) => {
        return prisma.followedCourse.findMany({
          include: { course: true },
          where: { course: { termId } },
        });
      })
    ).flat();

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
    ).flat();

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
    ).flat();

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
    const campusIdentifier = term[5];
    if (campusIdentifier === "0") {
      return "NEU";
    } else if (campusIdentifier === "2" || campusIdentifier === "8") {
      return "LAW";
    } else if (campusIdentifier === "4" || campusIdentifier === "5") {
      return "CPS";
    }
  }

  // Return an Object of the list of users associated with what class or section they are following
  async modelToUser(modelName: ModelName): Promise<Record<string, User[]>> {
    const columnName = `${modelName}_hash`;
    const pluralName = `${modelName}s`;
    const dbResults = await prisma.$queryRaw(
      `SELECT ${columnName}, JSON_AGG(JSON_BUILD_OBJECT('id', id, 'phoneNumber', phone_number)) FROM followed_${pluralName} JOIN users on users.id = followed_${pluralName}.user_id GROUP BY ${columnName}`
    );

    return Object.assign(
      {},
      ...dbResults.map((res) => ({ [res[columnName]]: res.json_agg }))
    );
  }
}

if (require.main === module) {
  macros.log("starting");
  const updater = Updater.create().then((updater) => {
    updater.start();
  });
}

export default Updater;
