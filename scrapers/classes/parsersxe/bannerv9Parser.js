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

const request = new Request("bannerv9Parser");

/**
 * Top level parser. Exposes nice interface to rest of app.
 */
class Bannerv9Parser {
  async main(termsUrl) {
    // const termIds = (await this.getTermList(termsUrl)).map((t) => { return t.termId; });
    // const suffixes = ['10', '12', '14', '15', '18', '25', '28', '30', '32', '34', '35', '38', '40', '50', '52', '54', '55', '58', '60'];
    // const undergradIds = termIds.filter((t) => { return suffixes.includes(t.slice(-2)); }).slice(0, suffixes.length);
    // macros.log(`scraping terms: ${undergradIds}`);
    macros.log(termsUrl);

    // If scrapers are simplified then this logic would ideally be moved closer to the scraper "entry-point"
    if (process.env.CUSTOM_SCRAPE && filters.truncate) {
      macros.log("Truncating courses and sections tables");
      const clearCourses = prisma.course.deleteMany({});
      const clearSections = prisma.section.deleteMany({});
      await prisma.$transaction([clearCourses, clearSections]);
      macros.log("Truncating elasticsearch classes index");
    }
    return this.scrapeTerms(["202130"]);
  }

  /**
   * Get the list of all available terms given the starting url
   * @param termsUrl the starting url to find the terms with v9
   * @returns List of {termId, description}
   */
  async getTermList(termsUrl) {
    const bannerTerms = await request.get({ url: termsUrl, json: true });
    return TermListParser.serializeTermsList(bannerTerms.body);
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
    const numTerms = 10;
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
