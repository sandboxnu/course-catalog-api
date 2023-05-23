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

/*
At most, there are 12 terms that we want to update - if we're in the spring & summer semesters have been posted
- Undergrad: Spring, summer (Full, I, and II)
- CPS: spring (semester & quarter), summer (semester & quarter)
- Law: spring (semester & quarter), summer (semester & quarter)

However, we allow for overriding this number via the `NUMBER_OF_TERMS` env variable
*/
const rawNumTerms = Number.parseInt(process.env.NUMBER_OF_TERMS);
export const NUMBER_OF_TERMS_TO_UPDATE = isNaN(rawNumTerms) ? 12 : rawNumTerms;

class Main {
  getTermIdsToScrape(termIds: string[]): string[] {
    const termsStr = process.env.TERMS_TO_SCRAPE;

    if (termsStr) {
      const terms = termsStr.split(",").filter((termId) => {
        if (!termIds.includes(termId) && termId !== null) {
          macros.warn(
            `${termId} not in list of term IDs from Banner! Skipping`
          );
        }
        return termIds.includes(termId);
      });

      macros.log("Scraping using user-provided TERMS_TO_SCRAPE");
      return terms;
    }

    const rawNumTerms = Number.parseInt(process.env.NUMBER_OF_TERMS);
    const numTerms = isNaN(rawNumTerms)
      ? NUMBER_OF_TERMS_TO_UPDATE
      : rawNumTerms;

    return termIds.slice(0, numTerms);
  }

  async main(): Promise<void> {
    const start = Date.now();
    // Get the TermInfo information from Banner
    const allTermInfos = await bannerv9parser.getAllTermInfos();
    const termsToScrape = this.getTermIdsToScrape(
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
