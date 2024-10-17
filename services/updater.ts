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
import classParser from "../scrapers/classes/parsersxe/classParser";
import { Section as ScrapedSection } from "../types/types";
import { sendNotifications } from "./notifyer";
import { NotificationInfo } from "../types/notifTypes";
import {
  ParsedCourseSR,
  convertCourseFromPrismaType,
} from "../types/scraperTypes";
import processor from "../scrapers/classes/main";
import filters from "../scrapers/filters";

/*
At most, there are 12 terms that we want to update - if we're in the spring & summer semesters have been posted
- Undergrad: Spring, summer (Full, I, and II)
- CPS: spring (semester & quarter), summer (semester & quarter)
- Law: spring (semester & quarter), summer (semester & quarter)

TODO - once #178 is merged, we should switch to that! Only update the active terms.
*/
export const NUMBER_OF_TERMS_TO_UPDATE = 12;

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

type ClassParserInfo = { termId: string; subject: string; classId: string };

class Updater {
  COURSE_MODEL: ModelName;
  SECTION_MODEL: ModelName;
  SEMS_TO_UPDATE: string[];

  static async getTermIdsToUpdate(): Promise<string[]> {
    const termsStr = process.env.TERMS_TO_SCRAPE;

    if (termsStr) {
      return termsStr.split(",");
    }

    // Get active term IDs from our database
    const termInfos = await prisma.termInfo.findMany({
      orderBy: { termId: "desc" },
      where: { active: true },
      take: NUMBER_OF_TERMS_TO_UPDATE,
    });

    return termInfos.map((t) => t.termId);
  }
  // produce a new Updater instance
  static async create(): Promise<Updater> {
    return new this(await Updater.getTermIdsToUpdate());
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
    // 5 min if prod, 1 min if dev.
    // In dev the cache will be used so we are not actually hitting NEU's servers anyway.
    const intervalTime = macros.PROD ? 300_000 : 60_000;

    // Flag only used for testing, since we only need the updater to run once
    if (!process.env.UPDATE_ONLY_ONCE) {
      setInterval(async () => {
        // Every subsequent run should re-check the term IDs. This checks if any new terms have been added (eg. if the scraper
        // ran and added a new term)
        this.SEMS_TO_UPDATE = await Updater.getTermIdsToUpdate();
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

  /**
   * Scrapes section data from Banner
   */
  private async scrapeDataToUpdate(): Promise<ScrapedSection[]> {
    // scrape everything
    const scrapedSections: ScrapedSection[] = (
      await pMap(this.SEMS_TO_UPDATE, (termId) => {
        return termParser.parseSections(termId);
      })
    ).reduce((acc, val) => acc.concat(val), []);

    let sections = scrapedSections;

    if (process.env.CUSTOM_SCRAPE) {
      // If we are doing a custom scrape, filter sections
      sections = scrapedSections.filter(
        (s) =>
          filters.campus(s.campus) &&
          filters.subject(s.subject) &&
          filters.courseNumber(parseInt(s.classId)),
      );
    }

    macros.log(`scraped ${sections.length} sections`);

    return sections;
  }

  /**
   * Sends notifications to users about sections/classes which now have seats open.
   */
  private async sendUserNotifications(
    sections: ScrapedSection[],
  ): Promise<void> {
    const notificationInfo = await this.getNotificationInfo(sections);
    const courseHashToUsers: Record<string, User[]> = await this.modelToUser(
      this.COURSE_MODEL,
    );
    const sectionHashToUsers: Record<string, User[]> = await this.modelToUser(
      this.SECTION_MODEL,
    );

    await sendNotifications(
      notificationInfo,
      courseHashToUsers,
      sectionHashToUsers,
    );
  }

  /**
   * Given a list of sections, check if they have corresponding classes already in Prisma.
   *
   * If not, those classes have not been scraped yet, and we want to ignore these sections for now.
   */
  private async filterSectionsWithExistingClasses(
    sections: ScrapedSection[],
    additionalExistingCourseIds?: Set<string>,
  ): Promise<{
    hasExistingClass: ScrapedSection[];
    missingClass: ScrapedSection[];
  }> {
    const courseIds: Set<string> = new Set(
      (await prisma.course.findMany({ select: { id: true } })).map(
        (elem) => elem.id,
      ),
    );

    const hasExistingClass = [];
    const missingClass = [];

    for (const section of sections) {
      const hash = keys.getClassHash(section);
      if (courseIds.has(hash) || additionalExistingCourseIds?.has(hash)) {
        hasExistingClass.push(section);
      } else {
        missingClass.push(section);
      }
    }

    return { hasExistingClass, missingClass };
  }

  /**
   * Given an array of {@link ScrapedSection}s, return a list of the classes associated with these sections.
   * Do not include duplicates; each class should only be included once.
   *
   * This function only returns classes which have a valid term ID - in other words, a term ID that we have already scraped.
   * So, if a new term is released on Banner and we haven't scraped it yet, we ignore those classes. It isn't the updater's job
   * to scrape new terms - that's the job of the scraper.
   */
  private async getCorrespondingClassInfo(
    sections: ScrapedSection[],
  ): Promise<ClassParserInfo[]> {
    const missingClasses = new Map<string, ClassParserInfo>();

    const validTermInfos = await prisma.termInfo.findMany({
      select: { termId: true },
    });
    const validTermIds = validTermInfos.map((t) => t.termId);

    for (const section of sections) {
      if (validTermIds.includes(section.termId)) {
        missingClasses[keys.getClassHash(section)] = {
          termId: section.termId,
          subject: section.subject,
          classId: section.classId,
        };
      }
    }

    return Object.values(missingClasses);
  }

  /**
   * Given a list of classes, run the processors on them. This standardizes how we handle prereqs, among other things
   */
  private async processClasses(
    classes: ParsedCourseSR[],
  ): Promise<ParsedCourseSR[]> {
    const termIds = classes.map((c) => c.termId);
    const otherPrismaClasses = await prisma.course.findMany({
      where: { termId: { in: termIds } },
    });
    const otherClasses = otherPrismaClasses.map((c) =>
      convertCourseFromPrismaType(c),
    );

    const allClasses = classes.concat(otherClasses);

    processor.runProcessors(allClasses);

    // We only return the classes that have been newly scraped, OR that were modified in the processor
    // eg. If we scrape a new class (say, CS2510) which has a prereq on an existing class (CS2500),
    //  now CS2500's "prereqsFor" will be updated, and we should re-insert it into the database
    return allClasses.filter(
      (c) => c.modifiedInProcessor || classes.includes(c),
    );
  }

  /**
   * Given a list of {@link ScrapedSection}s, scrape all of their associated classes.
   * The returned classes are UNPROCESSED (see {@link Updater.processClasses})
   */
  private async scrapeCorrespondingClasses(
    sections: ScrapedSection[],
  ): Promise<ParsedCourseSR[]> {
    // Determine which classes to scrape
    const missingClasses = await this.getCorrespondingClassInfo(sections);

    const classes = await pMap(
      missingClasses,
      async ({ termId, subject, classId }) =>
        classParser.parseClass(termId, subject, classId),
      { concurrency: 500 },
    );

    const filteredClasses = classes.filter(
      (c): c is ParsedCourseSR => c !== false,
    );

    return filteredClasses;
  }

  /**
   * Given a list of {@link ScrapedSection}s, scrapes AND processes all of their associated classes.
   */
  private async getCorrespondingClasses(
    sections: ScrapedSection[],
  ): Promise<ParsedCourseSR[]> {
    const classes = await this.scrapeCorrespondingClasses(sections);
    return this.processClasses(classes);
  }

  /**
   * Save the scraped sections to the database.
   */
  private async saveDataToDatabase(sections: ScrapedSection[]): Promise<void> {
    const dumpProcessorStartTime = Date.now();
    macros.log("Running dump processor");

    const { missingClass: missingClassInitial } =
      await this.filterSectionsWithExistingClasses(sections);
    macros.warn(
      `${
        missingClassInitial.length
      } missing sections: ${missingClassInitial.map((s) =>
        keys.getSectionHash(s),
      )}`,
    );

    const newClasses = await this.getCorrespondingClasses(missingClassInitial);
    const newClassIds = new Set(newClasses.map((c) => keys.getClassHash(c)));

    // Check again, this time including the newly scraped classes
    // This ensures that our class scraping was successful
    const { missingClass: missingClassFinal, hasExistingClass } =
      await this.filterSectionsWithExistingClasses(sections, newClassIds);

    if (missingClassFinal.length > 0) {
      const missingStr = missingClassFinal
        .map((s) => `${s.termId}/${s.subject}/${s.classId}/${s.crn}`)
        .join(", ");

      // TODO - this should be capable of alerting the Search team. Healthcheck? Slack integration?
      // This is an issue bc it means we found a class we couldn't properly scrape
      macros.warn(
        `We found sections with no corresponding classes: ${missingStr}`,
      );
    }

    await dumpProcessor.main({
      termDump: {
        sections: hasExistingClass,
        classes: newClasses,
        subjects: {},
      },
      deleteOutdatedData: true,
    });

    macros.log(
      `finished running dump processor in ${
        Date.now() - dumpProcessorStartTime
      } ms.`,
    );
  }

  /**
   * Updates frequently-changing data from sections (eg. seat count).
   * Does not update class data that doesn't change often, like the title and description!
   *
   * Notifies users if seats have opened up.
   */
  async update(): Promise<void> {
    macros.log(`Updating terms: ${this.SEMS_TO_UPDATE.join(", ")}`);

    const startTime = Date.now();

    // Scrape the data
    const sections = await this.scrapeDataToUpdate();
    // Send out notifications
    await this.sendUserNotifications(sections);
    // Save the data in our database
    await this.saveDataToDatabase(sections);

    const totalTime = Date.now() - startTime;
    macros.log(
      `${
        "Done running updater onInterval".underline.green
      }. It took ${totalTime} ms (${(totalTime / 60000).toFixed(
        2,
      )} minutes). Updated ${sections.length} sections.`,
    );
  }

  async getNotificationInfo(
    sections: ScrapedSection[],
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
        (hash: string) => !oldSectionsByClass[classHash].includes(hash),
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
        }),
      );
    }
    const watchedCourses = watchedCoursesTerms.reduce(
      (acc, val) => acc.concat(val),
      [],
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
    const dbResults = (await prisma.$queryRawUnsafe(
      `SELECT ${columnName}, JSON_AGG(JSON_BUILD_OBJECT('id', id, 'phoneNumber', phone_number)) FROM followed_${pluralName} JOIN users on users.id = followed_${pluralName}.user_id GROUP BY ${columnName}`,
    )) as Record<string, any>[];

    return Object.assign(
      {},
      ...dbResults.map((res) => ({ [res[columnName]]: res.json_agg })),
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
