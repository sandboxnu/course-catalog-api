/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import matchEmployees from "./employees/matchEmployees.js";
import macros from "../utils/macros.js";
import classes from "./classes/main.js";
import dumpProcessor from "../services/dumpProcessor.js";
import prisma from "../services/prisma.js";
import { instance as bannerv9parser } from "./classes/parsersxe/bannerv9Parser.js";
import bannerv9CollegeUrls from "./classes/bannerv9CollegeUrls.js";
import "colors";

// Main file for scraping
// Run this to run all the scrapers

class Main {
  async main(): Promise<void> {
    // Get the TermInfo information from Banner
    const allTermInfos = await bannerv9parser.getAllTermInfos(
      bannerv9CollegeUrls[0]
    );
    const currentTermInfos = await bannerv9parser.getCurrentTermInfos(
      allTermInfos
    );

    // Scraping should NOT be resolved simultaneously (eg. via p-map):
    //  *Employee scraping takes SO MUCH less time (which is why we run it first)
    //    * So, not running scraping in parallel doesn't hurt us
    //  * It would make logging a mess (are the logs from employee scraping, or from class scraping?)
    const mergedEmployees = await matchEmployees.main();
    const termDump = await classes.main(["neu"], allTermInfos);

    await dumpProcessor.main({
      termDump: termDump,
      profDump: mergedEmployees,
      destroy: true,
      currentTermInfos: currentTermInfos,
    });

    macros.log("Done scraping\n\n".green.underline);
  }
}

const instance = new Main();

if (require.main === module) {
  instance
    .main()
    .then(() => prisma.$disconnect())
    .catch((err) => macros.error(err));
}
