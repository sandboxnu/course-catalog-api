/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import matchEmployees from "./employees/matchEmployees";
import macros from "../utils/macros";
import classes from "./classes/main";
import dumpProcessor from "../services/dumpProcessor";
import prisma from "../services/prisma";
import bannerv9parser from "./classes/parsersxe/bannerv9Parser";
import bannerv9CollegeUrls from "./classes/bannerv9CollegeUrls";

// Main file for scraping
// Run this to run all the scrapers

class Main {
  async main() {

    // Get the TermInfo information from Banner
    const allTermInfos = await bannerv9parser.getAllTermInfos(bannerv9CollegeUrls[0]);
    const currentTermInfos = await bannerv9parser.getCurrentTermInfos(allTermInfos);

    const promises = [classes.main(["neu"], allTermInfos), matchEmployees.main()];
    const [termDump, mergedEmployees] = await Promise.all(promises);

    await dumpProcessor.main({
      termDump: termDump,
      profDump: mergedEmployees,
      destroy: true,
      currentTermInfos: currentTermInfos,
    });

    macros.log("done scrapers/main.js");
  }
}

const instance = new Main();

if (require.main === module) {
  instance
    .main()
    .then(() => prisma.$disconnect())
    .catch(err => macros.error(err));
}
