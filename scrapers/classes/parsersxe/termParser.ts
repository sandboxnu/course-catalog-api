/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import _ from "lodash";
import pMap from "p-map";
import keys from "../../../utils/keys";
import macros from "../../../utils/macros";
import Request from "../../request";
import ClassParser from "./classParser";
import SectionParser from "./sectionParser";
import util from "./util";
import { getSubjectDescriptions } from "./subjectAbbreviationParser";
import filters from "../../filters";
import {
  CourseSR,
  ParsedCourseSR,
  ParsedTermSR,
  SectionSR,
} from "../../../types/scraperTypes";
import { CourseRef, Section } from "../../../types/types";
import { DoRequestReturn } from "../../../types/requestTypes";
import { MultiProgressBars } from "multi-progress-bars";

const request = new Request("termParser");

class TermParser {
  /**
   * Parse a term
   * @param termId id of term to get
   * @returns Object {classes, sections} where classes is a list of class data
   */
  async parseTerm(
    termId: string,
    multiBar?: MultiProgressBars
  ): Promise<ParsedTermSR> {
    const subjectTable = await getSubjectDescriptions(termId);
    let sections: Section[] = await this.parseSections(termId);

    const courseIdentifiers: Record<string, CourseRef> = {};

    if (process.env.CUSTOM_SCRAPE) {
      // If we are doing a custom scrape, filter sections before scraping the course details
      sections = sections.filter(
        (s) =>
          filters.campus(s.campus) &&
          filters.subject(s.subject) &&
          filters.courseNumber(parseInt(s.classId))
      );
    }

    sections.forEach((section) => {
      const subject = section.subject;
      const classId = section.classId;
      courseIdentifiers[
        keys.getClassHash({
          host: "neu.edu",
          termId,
          subject,
          classId,
        })
      ] = { termId, subject, classId } as CourseRef;
    });

    const numCourses = Object.keys(courseIdentifiers).length;
    const incrementPercentage = 1 / numCourses;

    const barName = `Courses for ${termId}`;
    multiBar?.addTask(barName, { type: "percentage" });

    const unfilteredClasses = await pMap(
      Object.values(courseIdentifiers),
      async ({ subject, classId }) => {
        const result = await ClassParser.parseClass(termId, subject, classId);
        multiBar?.incrementTask(barName, { percentage: incrementPercentage });
        return result;
      },
      { concurrency: 500 }
    );

    // Course requests which fetch no data will return false
    let classes = unfilteredClasses.filter(
      (c): c is ParsedCourseSR => c !== false
    );

    // Custom scrapes should not scrape coreqs/prereqs/etc.
    if (!process.env.CUSTOM_SCRAPE) {
      multiBar?.incrementTask(barName, {
        percentage: 0,
        message: "Finalizing course cross-references",
      });
      classes = await this.addCourseRefs(classes, courseIdentifiers, termId);
    }

    macros.log(
      `Term ${termId} scraped ${classes.length} classes and ${sections.length} sections`
    );

    multiBar?.done(barName, {
      message: `Term ${termId} scraped ${classes.length} classes and ${sections.length} sections`,
    });
    return { classes, sections, subjects: subjectTable };
  }

  /**
   * Appends coreqs/prereqs/etc to the array of classes
   * @param {*} classes the array of classes we have scraped so far
   * @param {*} courseIdentifiers map of classHash to { termId, subject, classId }
   * @param {*} termId the termId we are scraping
   * @returns the input classes array, mutated to include coreqs/prereqs/etc
   */
  async addCourseRefs(
    classes: ParsedCourseSR[],
    courseIdentifiers: Record<string, CourseRef>,
    termId: string
  ): Promise<ParsedCourseSR[]> {
    const refsPerCourse = classes.map((c) => ClassParser.getAllCourseRefs(c));
    const courseRefs = Object.assign({}, ...refsPerCourse); // Shallow copy
    await pMap(
      Object.keys(courseRefs),
      async (ref) => {
        if (!(ref in courseIdentifiers)) {
          const { subject, classId } = courseRefs[ref];
          const referredClass = await ClassParser.parseClass(
            termId,
            subject,
            classId
          );
          if (referredClass) {
            classes.push(referredClass);
          }
        }
      },
      { concurrency: 500 }
    );

    return classes;
  }

  async parseSections(termId: string): Promise<Section[]> {
    const searchResults = await this.requestsSectionsForTerm(termId);

    return searchResults.map((a) => {
      return SectionParser.parseSectionFromSearchResult(a);
    });
  }

  /**
   * Gets information about all the sections from the given term code.
   * @param termId
   * @return {Promise<Array>}
   */
  async requestsClassesForTerm(termId: string): Promise<CourseSR[]> {
    const cookiejar = await util.getCookiesForSearch(termId);
    // second, get the total number of sections in this semester
    try {
      return (await this.concatPagination(async (offset, pageSize) => {
        const req = await request.get({
          url: "https://nubanner.neu.edu/StudentRegistrationSsb/ssb/courseSearchResults/courseSearchResults",
          qs: {
            txt_term: termId,
            pageOffset: offset,
            pageMaxSize: pageSize,
          },
          jar: cookiejar,
          json: true,
        });
        if (req.body.success) {
          return { items: req.body.data, totalCount: req.body.totalCount };
        }
        return false;
      })) as CourseSR[];
    } catch (error) {
      macros.error(`Could not get class data for ${termId}`);
    }
    return Promise.reject();
  }

  /**
   * Gets information about all the sections from the given term code.
   * @param termId
   * @return {Promise<Array>}
   */
  async requestsSectionsForTerm(termId: string): Promise<SectionSR[]> {
    const cookiejar = await util.getCookiesForSearch(termId);
    // second, get the total number of sections in this semester
    try {
      return (await this.concatPagination(async (offset, pageSize) => {
        const req = await request.get({
          url: "https://nubanner.neu.edu/StudentRegistrationSsb/ssb/searchResults/searchResults",
          qs: {
            txt_term: termId,
            pageOffset: offset,
            pageMaxSize: pageSize,
          },
          jar: cookiejar,
          json: true,
        });
        if (req.body.success) {
          return { items: req.body.data, totalCount: req.body.totalCount };
        }
        return false;
      })) as SectionSR[];
    } catch (error) {
      macros.error(`Could not get section data for ${termId}`);
    }
    // TEMPORARY FIX:
    // Banner is responding to requests for some sections/terms with success as false. This
    // is a temporary fix so that the majority of functioning updating terms can still update
    return [];
    // return Promise.reject();
  }

  /**
   * Send paginated requests and merge the results
   * @param doRequest - The callback that sends the response.
   * @param itemsPerRequest - the number of items allowed per request
   */
  async concatPagination(
    doRequest: (x: number, y: number) => Promise<false | DoRequestReturn>,
    itemsPerRequest = 500
  ): Promise<(SectionSR | CourseSR)[]> {
    // Send initial request just to get the total number of items
    const countRequest = await doRequest(0, 1);
    if (!countRequest) {
      throw Error("Missing data");
    }

    const { totalCount } = countRequest;

    // third, create a thread pool to make requests, 500 items per request.
    // (500 is the limit)
    const sectionsPool: Promise<false | DoRequestReturn>[] = [];
    for (
      let nextCourseIndex = 0;
      nextCourseIndex < totalCount;
      nextCourseIndex += itemsPerRequest
    ) {
      sectionsPool.push(doRequest(nextCourseIndex, itemsPerRequest));
    }

    // finally, merge all the items into one array
    const chunks = await Promise.all(sectionsPool);
    if (chunks.some((s) => s === false)) {
      throw Error("Missing data");
    }
    return _(chunks as DoRequestReturn[])
      .map("items")
      .flatten()
      .value() as (SectionSR | CourseSR)[];
  }
}

/**
 * @callback TermParser~doRequest
 * @param {number} offset number of items to offset the request pagination
 * @param {number} pageSize number of items to get in the page
 * @returns An object with totalCount and items
 */

const instance = new TermParser();

if (require.main === module) {
  instance.parseTerm("202034");
}

export default instance;
