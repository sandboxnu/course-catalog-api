/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import _ from "lodash";
import URI from "urijs";

import cache from "../cache";
import macros from "../../utils/macros";
import differentCollegeUrls from "./differentCollegeUrls";
import bannerv9CollegeUrls from "./bannerv9CollegeUrls";

// Processors
import markMissingPrereqs from "./processors/markMissingPrereqs";
import termStartEndDate from "./processors/termStartEndDate";
import addPreRequisiteFor from "./processors/addPreRequisiteFor";

// Parsers
import bannerv9Parser from "./parsersxe/bannerv9Parser";

// This is the main entry point for scraping classes
// This file calls into the first Banner v8 parser, the processors, and hopefully soon, the v9 parsers too.
// Call the main(['neu']) function below to scrape a college
// This file also generates the search index and data dumps.

class Main {
  // Runs the processors over a termDump.
  // The input of this function should be the output of restructureData, above.
  // The updater.js calls into this function to run the processors over the data scraped as part of the processors.
  runProcessors(dump) {
    // Run the processors, sequentially
    markMissingPrereqs.go(dump);
    termStartEndDate.go(dump);

    // Add new processors here.
    addPreRequisiteFor.go(dump);

    return dump;
  }

  async main(collegeAbbrs) {
    if (!collegeAbbrs) {
      macros.error("Need collegeAbbrs for scraping classes");
      return null;
    }

    // Grabs the Banner URL that we're about to scrape
    const bannerv9Url = bannerv9CollegeUrls[0];

    const cacheKey = collegeAbbrs.join(",");
    if (macros.DEV && !process.env.CUSTOM_SCRAPE) {
      const cached = await cache.get(macros.DEV_DATA_DIR, "classes", cacheKey);
      if (cached) {
        macros.log("using cached class data - not rescraping");
        // We update the Term IDs list anyways:
        bannerv9Parser.updateTermIDs(
          await bannerv9Parser.getTermList(bannerv9Url)
        );
        return cached;
      }
    }

    macros.warn("BOUT TO SCRAPE");
    const bannerv9ParserOutput = await bannerv9Parser.main(bannerv9Url);
    macros.warn("SCRAPEd");

    const dump = this.runProcessors(bannerv9ParserOutput);

    ////////// Not in use right now ///////////////////
    // Originally intented for SearchNEU to branch out to other colleges, that thread's been inactive since ~2017

    // const bannerv8Urls = this.getUrlsFromCollegeAbbrs(
    //   collegeAbbrs,
    //   differentCollegeUrls
    // );
    // if (bannerv8Urls.length > 1) {
    //   macros.error("Unsure if can do more than one abbr at at time. Exiting. ");
    //   return null;
    // }

    ///////////// Ditto, see above /////////////////////
    // const bannerv9Urls = this.getUrlsFromCollegeAbbrs(
    //   collegeAbbrs,
    //   bannerv9CollegeUrls
    // );
    // if (bannerv9Urls.length > 1) {
    //   macros.error("Unsure if can do more than one abbr at at time. Exiting. ");
    //   return null;
    // }

    // We don't overwrite cache on custom scrape - cache should always represent a full scrape
    if (macros.DEV && !process.env.CUSTOM_SCRAPE) {
      await cache.set(macros.DEV_DATA_DIR, "classes", cacheKey, dump);
      macros.log("classes file saved for", collegeAbbrs, "!");
    }

    return dump;
  }

  /**
   * @deprecated This method is no longer in use. It was originally intended for branching SearchNEU out to other colleges, but is unecessary as long as we are limited to Northeastern.
   * @param {string[]} collegeAbbrs Main domain names of other colleges
   * @param {string[]} listToCheck A list of URLs to check
   * @returns
   */
  getUrlsFromCollegeAbbrs(collegeAbbrs, listToCheck) {
    // This list is modified below, so clone it here so we don't modify the input object.
    collegeAbbrs = collegeAbbrs.slice(0);

    if (collegeAbbrs.length > 1) {
      // Need to check the processors... idk
      macros.error("Unsure if can do more than one abbr at at time. Exiting. ");
      return null;
    }

    const urlsToProcess = [];

    listToCheck.forEach((url) => {
      const urlParsed = new URI(url);

      let primaryHost = urlParsed
        .hostname()
        .slice(urlParsed.subdomain().length);

      if (primaryHost.startsWith(".")) {
        primaryHost = primaryHost.slice(1);
      }

      primaryHost = primaryHost.split(".")[0];

      if (collegeAbbrs.includes(primaryHost)) {
        _.pull(collegeAbbrs, primaryHost);

        urlsToProcess.push(url);
      }
    });

    macros.log("Processing ", urlsToProcess);
    return urlsToProcess;
  }
}

const instance = new Main();

if (require.main === module) {
  // instance.main(['mscc']);
  // instance.main(['uncfsu']);
  instance.main(["neu"]);
  // instance.main(['fit']);
}

export default instance;
