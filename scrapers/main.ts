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
  async main(): Promise<void> {
    const start = Date.now();
    // Get the TermInfo information from Banner
    const allTermInfos = await bannerv9parser.getAllTermInfos();
    const currentTermInfos = await bannerv9parser.getCurrentTermInfos(
      allTermInfos
    );

    // Scraping should NOT be resolved simultaneously (eg. via p-map):
    //  *Employee scraping takes SO MUCH less time (which is why we run it first)
    //    * So, not running scraping in parallel doesn't hurt us
    //  * It would make logging a mess (are the logs from employee scraping, or from class scraping?)
    const mergedEmployees = await matchEmployees.main();
    const termDump = await classes.main(allTermInfos);

    await dumpProcessor.main({
      termDump: termDump,
      profDump: mergedEmployees,
      destroy: true,
      currentTermInfos: currentTermInfos,
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

if (require.main === module) {
  instance
    .main()
    .then(() => prisma.$disconnect())
    .catch((err) => macros.error(err));
}
