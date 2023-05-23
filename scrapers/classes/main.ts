/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import "colors";

import cache from "../cache";
import macros from "../../utils/macros";

// Processors
import markMissingRequisites from "./processors/markMissingRequisites";
import addPrerequisiteFor from "./processors/addPrerequisiteFor";

// Parsers
import { instance as bannerv9Parser } from "./parsersxe/bannerv9Parser";
import { ParsedTermSR } from "../../types/scraperTypes";

// This is the main entry point for scraping classes
// This file calls into the first Banner v8 parser, the processors, and hopefully soon, the v9 parsers too.
// Call the main(['neu']) function below to scrape a college
// This file also generates the search index and data dumps.

class Main {
  static COLLEGE_ABRV = "neu";

  /**
   * Standardize the data we get back from Banner, to ensure it matches our expectations.
   */
  runProcessors(dump: ParsedTermSR): ParsedTermSR {
    // Run the processors, sequentially
    markMissingRequisites.go(dump);
    addPrerequisiteFor.go(dump);

    return dump;
  }

  /**
   * The main entrypoint for scraping courses.
   */
  async main(termIds: string[]): Promise<ParsedTermSR> {
    if (macros.DEV && !process.env.CUSTOM_SCRAPE) {
      const cached = await cache.get(
        macros.DEV_DATA_DIR,
        "classes",
        Main.COLLEGE_ABRV
      );

      if (cached) {
        macros.log("Using cached class data - not rescraping");
        return cached as ParsedTermSR;
      }
    }

    macros.log("Scraping classes...".blue.underline);
    const bannerv9ParserOutput = await bannerv9Parser.main(termIds);
    macros.log("Done scraping classes\n\n".green.underline);

    const dump = this.runProcessors(bannerv9ParserOutput);

    // We don't overwrite cache on custom scrape - cache should always represent a full scrape
    if (macros.DEV && !process.env.CUSTOM_SCRAPE) {
      await cache.set(macros.DEV_DATA_DIR, "classes", Main.COLLEGE_ABRV, dump);
      macros.log("classes file saved!");
    }

    return dump;
  }
}

const instance = new Main();

export default instance;
