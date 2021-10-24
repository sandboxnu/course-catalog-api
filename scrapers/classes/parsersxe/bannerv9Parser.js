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

const request = new Request("bannerv9Parser");

/**
 * Top level parser. Exposes nice interface to rest of app.
 */
class Bannerv9Parser {
  async main(termsUrl) {
    const termIds = await this.getTermList(termsUrl);
    macros.log(termIds);
    this.updateTermIDs(termIds);
    macros.log(`scraping terms: ${termIds}`);
    macros.log(termsUrl);

    // If scrapers are simplified then this logic would ideally be moved closer to the scraper "entry-point"
    if (process.env.CUSTOM_SCRAPE && filters.truncate) {
      macros.log("Truncating courses and sections tables");
      const clearCourses = prisma.course.deleteMany({});
      const clearSections = prisma.section.deleteMany({});
      await prisma.$transaction([clearCourses, clearSections]);
      macros.log("Truncating elasticsearch classes index");
      await elastic.resetIndex(elastic.CLASS_INDEX, classMap);
    }
    //return this.scrapeTerms(termIds);
  }

  /**
   * Get the list of all available terms given the starting url
   * @param termsUrl the starting url to find the terms with v9
   * @returns List of {termId, description}
   */
  async getTermList(termsUrl) {
    // Query the Banner URL to get a list of the terms
    const bannerTerms = await request.get({ url: termsUrl, json: true });

    // Parse to get the actual term information
    const termList = TermListParser.serializeTermsList(bannerTerms.body);
    // We have 19 terms in a full academic year (between all of the schools), so we just grab the first 20 to be safe
    const termsInAYear = 20;

    const filterdTermIds = termList
      // Sort by descending order (to get the most recent term IDs first)
      .sort((a, b) => b.termId - a.termId)
      // Only return a full year's worth of term IDs
      .slice(0, termsInAYear);

    return filterdTermIds;
  }

  async updateTermIDs(termInfo) {
    const termIds = termInfo.map((t) => {
      return t.termId;
    });

    // Delete the old terms (ie. any terms that aren't in the list we pass this function)
    await prisma.termInfo.deleteMany({
      where: {
        termId: { notIn: Array.from(termIds) },
      },
    });

    // Upsert new term IDs, along with their names and sub college
    for (let term of termInfo) {
      await prisma.termInfo.upsert({
        where: { termId: term.termId },
        update: {
          text: term.text,
          subCollege: term.subCollegeName,
        },
        create: {
          termId: term.termId,
          text: term.text,
          subCollege: term.subCollegeName,
        },
      });
    }
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
