/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import _ from "lodash";
import pMap from "p-map";
import Request from "../../request";
import macros from "../../../utils/macros";
import TermListParser from "./termListParser";
import TermParser from "./termParser";
import ClassParser from "./classParser";
import SectionParser from "./sectionParser";
import filters from "../../filters";
import prisma from "../../../services/prisma";
import elastic from "../../../utils/elastic";
import classMap from "../classMapping.json";

// Only used to query the term IDs, so we never want to use a cached version
const request = new Request("bannerv9Parser", { cache: false });

/*
At most, there are 12 terms that we want to update. Say we're in the spring, and summer semesters have been posted 
(so we want to update both)
- Undergrad: 
  - Spring semester
  - Full summer
  - Summer I
  - Summer II
- CPS
  - Spring semester
  - Spring quarter
  - Summer semester
  - Summer quarter
- Law
  - Spring semester
  - Spring quarter
  - Summer semester
  - Summer quarter

To be safe, we scrape the latest 12 terms. 
*/
export const NUMBER_OF_TERMS_TO_UPDATE = 12;

/**
 * Top level parser. Exposes nice interface to rest of app.
 */
class Bannerv9Parser {
  async main(termInfos) {
    const termIds = termInfos
      .map((t) => t.termId)
      .slice(0, NUMBER_OF_TERMS_TO_UPDATE);
    macros.log(`scraping terms: ${termIds}`);

    // If scrapers are simplified then this logic would ideally be moved closer to the scraper "entry-point"
    if (process.env.CUSTOM_SCRAPE && filters.truncate) {
      macros.log("Truncating courses and sections tables");
      const clearCourses = prisma.course.deleteMany({});
      const clearSections = prisma.section.deleteMany({});
      await prisma.$transaction([clearCourses, clearSections]);
      macros.log("Truncating elasticsearch classes index");
      await elastic.resetIndex(elastic.CLASS_INDEX, classMap);
    }
    return this.scrapeTerms(termIds);
  }

  /**
   * Get the list of all available terms given the starting url
   * @param termsUrl the starting url to find the terms with v9
   * @returns List of {termId, description}
   */
  async getAllTermInfos(termsUrl) {
    // Query the Banner URL to get a list of the terms & parse
    const bannerTerms = await request.get({
      url: termsUrl,
      json: true,
      cache: false,
    });
    const termList = TermListParser.serializeTermsList(bannerTerms.body);

    // Sort by descending order (to get the most recent term IDs first)
    return termList.sort((a, b) => b.termId - a.termId);
  }

  /**
   * Given a list of all TermInfos, this function returns only those TermInfos for which we have data
   * @param {*} allTermInfos A list of ALL term infos queried from Banner (ie. not filtered)
   */
  async getCurrentTermInfos(allTermInfos) {
    /* Note the distinction between termID and TermInfo:

    - A termID is a string (eg. '202230')
    - A TermInfo is an object, containing the keys:
      - 'termId' (which is a termID)
      - 'subCollege' - the name of the college associated with this term
      - 'text' - an English, textual description of this term (eg. 'Spring 2021 Semester')
    
    Would be nice if this was a typescript file :(
    */

    // Get a list of termIDs for which we already have data (ie. terms we've scraped, and that actually have data stored)
    const existingIds = (await prisma.course.groupBy({ by: ["termId"] })).map(
      (t) => t["termId"]
    );

    // Get the TermInfo associated with each term ID
    const existingTermInfos = existingIds
      .map((termId) =>
        allTermInfos.find((termInfo) => termInfo["termId"] === termId)
      )
      // Filter out any undefined values (this should never be the case, but better safe than sorry)
      .filter((termInfo) => termInfo !== undefined);

    return existingTermInfos;
  }

  /**
   * Scrape all the class data in a set of terms
   * @param termIds array of terms to scrape in
   * @returns Object {classes, sections} where classes is a list of class data
   */
  async scrapeTerms(termIds) {
    const termData = await pMap(termIds, (p) => {
      return TermParser.parseTerm(p);
    });
    return _.mergeWith(...termData, (a, b) => {
      if (Array.isArray(a)) {
        return a.concat(b);
      }
      return { ...a, ...b };
    });
  }

  /**
   * Scrape all the details of a specific class and associated sections
   * @param termId termId the class is in
   * @param subject the subject of the class ("CS")
   * @param classId the course number of the class (2500)
   * @returns Object {classes, sections} where classes and sections are arrays,
   *          though classes should only have 1 element
   */
  async scrapeClass(termId, subject, courseNumber) {
    return {
      classes: [await ClassParser.parseClass(termId, subject, courseNumber)],
      sections: await SectionParser.parseSectionsOfClass(
        termId,
        subject,
        courseNumber
      ),
    };
  }

  // Just a convient test method, if you want to
  async test() {
    const numTerms = 20;
    const url = `https://nubanner.neu.edu/StudentRegistrationSsb/ssb/classSearch/getTerms?offset=1&max=${numTerms}&searchTerm=`;
    const output = await this.main(url);
    // eslint-disable-next-line global-require
    require("fs").writeFileSync(
      "parsersxe.json",
      JSON.stringify(output, null, 4)
    );
  }
}

Bannerv9Parser.prototype.Bannerv9Parser = Bannerv9Parser;
const instance = new Bannerv9Parser();

if (require.main === module) {
  instance.test();
}

export default instance;
