/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import _ from "lodash";
import pMap from "p-map";
import { Course, Section } from "@prisma/client";
import * as https from "https";
import * as http from "http";
import * as httpSignature from "http-signature";

import macros from "../utils/macros";
import prisma from "./prisma";
import keys from "../utils/keys";
import dumpProcessor from "./dumpProcessor";
import termParser from "../scrapers/classes/parsersxe/termParser";
import { Section as ScrapedSection } from "../types/types";

// ======= TYPES ======== //
// A collection of structs for simpler querying of pre-scrape data
interface OldData {
  oldClassLookup: Record<string, Course>;
  oldSectionLookup: Record<string, Section>;
  oldSectionsByClass: Record<string, string[]>;
}

// Stores information for all changes to a course or section
export interface NotificationInfo {
  updatedCourses: CourseNotificationInfo[];
  updatedSections: SectionNotificationInfo[];
}

// marks new sections being added to a Course
interface CourseNotificationInfo {
  subject: string;
  courseId: string;
  termId: string;
  courseHash: string;
  numberOfSectionsAdded: number;
  campus: string;
}

// marks seats becoming available in a section
interface SectionNotificationInfo {
  subject: string;
  courseId: string;
  sectionHash: string;
  termId: string;
  seatsRemaining: number;
  crn: string;
  campus: string;
}

// the types of models/records that a user can follow
type ModelName = "course" | "section";

class Updater {
  // produce a new Updater instance
  COURSE_MODEL: ModelName;

  SECTION_MODEL: ModelName;

  SEMS_TO_UPDATE: string[];

  static create() {
    return new this();
  }

  // DO NOT call the constructor, instead use .create
  constructor() {
    this.COURSE_MODEL = "course";
    this.SECTION_MODEL = "section";
    this.SEMS_TO_UPDATE = ["202210", "202160", "202154", "202150", "202140"];
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

    await dumpProcessor.main({
      termDump: { sections, classes: {}, subjects: {} },
    });

    const totalTime = Date.now() - startTime;

    macros.log(
      `Done running updater onInterval. It took ${totalTime} ms. Updated ${sections.length} sections.`
    );

    await this.sendUpdates(notificationInfo);
  }

  async getNotificationInfo(
    sections: ScrapedSection[]
  ): Promise<NotificationInfo> {
    const { oldClassLookup, oldSectionLookup, oldSectionsByClass } =
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

    // find courses with added sections and add to notificationInfo
    Object.entries(newSectionsByClass).forEach(([classHash, sectionHashes]) => {
      if (!oldSectionsByClass[classHash]) return;

      const newSectionCount = sectionHashes.filter(
        (hash: string) => !oldSectionsByClass[classHash].includes(hash)
      ).length;
      if (newSectionCount > 0) {
        const { id, subject, classId, termId } = oldClassLookup[classHash];

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

    // find sections with more seats or waitlist spots and add to notificationInfo
    sections.forEach((s: ScrapedSection) => {
      const sectionId = keys.getSectionHash(s);
      const oldSection = oldSectionLookup[sectionId];
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
    const oldClasses: Course[] = (
      await pMap(this.SEMS_TO_UPDATE, (termId) => {
        return prisma.course.findMany({
          where: { termId },
        });
      })
    ).flat();

    const oldSections: Section[] = (
      await pMap(this.SEMS_TO_UPDATE, (termId) => {
        return prisma.section.findMany({
          where: { course: { termId } },
        });
      })
    ).flat();

    const oldClassLookup: Record<string, Course> = _.keyBy(
      oldClasses,
      (c) => c.id
    );
    const oldSectionLookup: Record<string, Section> = _.keyBy(
      oldSections,
      (s) => s.id
    );

    const oldSectionsByClass: Record<string, string[]> = {};
    for (const s of oldSections) {
      if (!(s.classHash in oldSectionsByClass)) {
        oldSectionsByClass[s.classHash] = [];
      }

      oldSectionsByClass[s.classHash].push(s.id);
    }

    return { oldClassLookup, oldSectionLookup, oldSectionsByClass };
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

  async sendUpdates(notificationInfo: NotificationInfo): Promise<void> {
    if (
      notificationInfo.updatedCourses.length === 0 &&
      notificationInfo.updatedSections.length === 0
    ) {
      macros.log("no updates to send!");
      return;
    }

    const body = JSON.stringify(notificationInfo);
    const DEST_URL = macros.PROD
      ? process.env.UPDATER_URL
      : "http://localhost:5000/api/notify_users";
    const key = process.env.WEBHOOK_PRIVATE_KEY;
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = macros.PROD
      ? https.request(DEST_URL, options)
      : http.request(DEST_URL, options);

    req.on("error", (e) => {
      macros.error(`problem with updater request: ${e.message}`);
    });
    req.on("response", (res) => {
      if (res.statusCode !== 200) {
        macros.error(res.statusCode, res.statusMessage);
      }
    });
    httpSignature.sign(req, {
      key: key,
      keyId: "hello",
    });

    req.end(body);
    macros.log("Request made from updater!");
  }
}

if (require.main === module) {
  Updater.create().start();
}

export default Updater;
