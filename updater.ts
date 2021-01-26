/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import _ from 'lodash';
import { Course, Section } from '@prisma/client';

import macros from './macros';
import prisma from './prisma';
import Keys from './Keys';
// import notifyer from './notifyer';
import dumpProcessor from './dumpProcessor';
import termParser from './scrapers/classes/parsersxe/termParser';
import { Section as ScrapedSection } from './types';

// 1. updates for CPS & Law (including quarterly and semesterly versions)
// 2. compile data to the right output format

// ======= TYPES ======== //
// A collection of structs for simpler querying of pre-scrape data
interface OldData {
  oldClassLookup: Record<string, Course>,
  oldSectionLookup: Record<string, Section>,
  oldSectionsByClass: Record<string, string[]>
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
type ModelName = 'course' | 'section';

class Updater {
  // produce a new Updater instance
  COURSE_MODEL: ModelName;

  SECTION_MODEL: ModelName;

  SEM_TO_UPDATE: string;

  CAMPUS: string;

  static create() {
    return new this();
  }

  // DO NOT call the constructor, instead use .create
  constructor() {
    this.COURSE_MODEL = 'course';
    this.SECTION_MODEL = 'section';
    this.SEM_TO_UPDATE = '202130';
    this.CAMPUS = Updater.getCampusFromTerm(this.SEM_TO_UPDATE);
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
        macros.warn('Updater failed with: ', e);
      }
    }, intervalTime);
    this.update();
  }

  // Update classes and sections users are watching and notify them if seats have opened up
  async update() {
    macros.log('updating');

    const startTime = Date.now();

    const { oldClassLookup, oldSectionLookup, oldSectionsByClass } = await this.getOldData();

    // scrape everything
    const sections: ScrapedSection[] = await termParser.parseSections(this.SEM_TO_UPDATE);
    const newSectionsByClass: Record<string, string[]> = {};

    for (const s of sections) {
      const hash: string = Keys.getClassHash(s);
      if (!newSectionsByClass[hash]) newSectionsByClass[hash] = [];
      newSectionsByClass[hash].push(Keys.getSectionHash(s));
    }

    const notificationInfo: NotificationInfo = { updatedCourses: [], updatedSections: [] };

    Object.entries(newSectionsByClass).forEach(([classHash, sectionHashes]) => {
      if (!oldSectionsByClass[classHash]) return;

      const newSectionCount = sectionHashes.filter((hash: string) => !oldSectionsByClass[classHash].includes(hash)).length;
      if (newSectionCount > 0) {
        const { id, subject, classId, termId } = oldClassLookup[classHash];

        notificationInfo.updatedCourses.push({
          termId,
          subject,
          courseId: classId,
          courseHash: id,
          campus: this.CAMPUS,
          numberOfSectionsAdded: newSectionCount,
        });
      }
    });

    sections.forEach((s: ScrapedSection) => {
      const sectionId = Keys.getSectionHash(s);
      const oldSection = oldSectionLookup[sectionId];
      if (!oldSection) return;

      if ((s.seatsRemaining > 0 && oldSection.seatsRemaining <= 0)
          || (s.waitRemaining > 0 && oldSection.waitRemaining <= 0)) {
        const { termId, subject, classId } = Keys.parseSectionHash(sectionId);

        notificationInfo.updatedSections.push({
          termId,
          subject,
          courseId: classId,
          crn: s.crn,
          sectionHash: sectionId,
          campus: this.CAMPUS,
          seatsRemaining: s.seatsRemaining,
        });
      }
    });

//     await this.sendMessages(notifications, classHashToUsers, sectionHashToUsers);
    await dumpProcessor.main({ termDump: { sections, classes: {}, subjects: {} } });

    const totalTime = Date.now() - startTime;

    macros.log(`Done running updater onInterval. It took ${totalTime} ms. Updated ${sections.length} sections.`);

    // macros.log(`Done running updater onInterval. It took ${totalTime} ms. Updated ${sections.length} sections and sent ${notifications.length} messages.`);

//     macros.logAmplitudeEvent('Updater', {
//       totalTime: totalTime,
//       sent: notifications.length,
//     });
  }

  // return a collection of data structures used for simplified querying of data
  async getOldData(): Promise<OldData> {
    const oldClasses: Course[] = await prisma.course.findMany({ where: { termId: this.SEM_TO_UPDATE }});
    const oldSections: Section[] = await prisma.section.findMany({ where: { course: { termId: this.SEM_TO_UPDATE }}});

    const oldClassLookup: Record<string, Course> = _.keyBy(oldClasses, (c) => c.id);
    const oldSectionLookup: Record<string, Section> = _.keyBy(oldSections, (s) => s.id);

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
    if (campusIdentifier === '0') {
      return 'NEU';
    } else if (campusIdentifier === '2' || campusIdentifier === '8') {
      return 'LAW';
    } else if (campusIdentifier === '4' || campusIdentifier === '5') {
      return 'CPS';
    }
  }
}

if (require.main === module) {
  Updater.create().start();
}

export default Updater;
