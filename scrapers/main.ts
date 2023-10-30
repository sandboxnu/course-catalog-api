/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import matchEmployees from "./employees/matchEmployees";
import macros from "../utils/macros";
import classes from "./classes/main";
import dumpProcessor from "../services/dumpProcessor";
import prisma from "../services/prisma";
import { instance as bannerv9parser } from "./classes/parsersxe/bannerv9Parser";
import "colors";

// Main file for scraping
// Run this to run all the scrapers

class Main {
  /**
   * Given a list of term IDs, return a subset which will be used to run the scrapers.
   * The returned term IDs can be determined by environment variables or by their existance in our database
   */
  async getTermIdsToScrape(termIds: string[]): Promise<string[]> {
    const termsToScrapeStr = process.env.TERMS_TO_SCRAPE;
    const numOfTermsStr = Number.parseInt(process.env.NUMBER_OF_TERMS);

    if (termsToScrapeStr) {
      const unfilteredTermIds = termsToScrapeStr.split(",");

      const terms = unfilteredTermIds.filter((termId) => {
        const keep = termIds.includes(termId);
        if (!keep && termId !== null) {
          macros.warn(`"${termId}" not in given list - skipping`);
        }
        return keep;
      });

      macros.log("Scraping using user-provided TERMS_TO_SCRAPE");
      return terms;
    } else if (!isNaN(numOfTermsStr)) {
      return termIds.slice(0, numOfTermsStr);
    } else {
      const termInfosWithData = await prisma.termInfo.findMany({
        select: { termId: true },
      });
      const termIdsWithData = termInfosWithData.map((t) => t.termId).sort();
      const newestTermIdWithData = termIdsWithData[termIdsWithData.length - 1];

      return termIds.filter(
        (t) => newestTermIdWithData === undefined || t > newestTermIdWithData
      );
    }
  }

  async main(): Promise<void> {
    const start = Date.now();
    // Get the TermInfo information from Banner
    const allTermInfos = await bannerv9parser.getAllTermInfos();
    const termsToScrape = await this.getTermIdsToScrape(
      allTermInfos.map((t) => t.termId)
    );

    // Scraping should NOT be resolved simultaneously (eg. via p-map):
    //  *Employee scraping takes SO MUCH less time (which is why we run it first)
    //    * So, not running scraping in parallel doesn't hurt us
    //  * It would make logging a mess (are the logs from employee scraping, or from class scraping?)
    const mergedEmployees = await matchEmployees.main();
    const termDump = await classes.main(termsToScrape);

    await dumpProcessor.main({
      termDump: termDump,
      profDump: mergedEmployees,
      deleteOutdatedData: true,
      allTermInfos: allTermInfos,
    });

    const totalTime = Date.now() - start;

    macros.log(
      `Done scraping: took ${totalTime} ms (${(totalTime / 60000).toFixed(
        2
      )} minutes)\n\n`.green.underline
    );
  }
}

const instance = new Main();
export default instance;

if (require.main === module) {
  instance
    .main()
    .then(() => prisma.$disconnect())
    .catch((err) => macros.error(err));
}
