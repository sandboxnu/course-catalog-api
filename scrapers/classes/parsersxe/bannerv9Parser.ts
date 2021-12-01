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
import {Section, TermInfo} from "../../../types/types";
import {EsMapping} from "../../../types/searchTypes";
import {ParsedCourseSR, ParsedTermSR} from "../../../types/scraperTypes";

// Only used to query the term IDs, so we never want to use a cached version
const request = new Request("bannerv9Parser", {cache: false});

/*
At most, there are 12 terms that we want to update - if we're in the spring & summer semesters have been posted
- Undergrad: Spring, summer (Full, I, and II)
- CPS: spring (semester & quarter), summer (semester & quarter)
- Law: spring (semester & quarter), summer (semester & quarter)
*/
export const NUMBER_OF_TERMS_TO_UPDATE = 12;

/**
 * Top level parser. Exposes nice interface to rest of app.
 */
export class Bannerv9Parser {
	async main(termInfos: TermInfo[]): Promise<ParsedTermSR> {

		const termIds: string[] = termInfos
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
			await elastic.resetIndex(elastic.CLASS_INDEX, classMap as EsMapping);
		}
		return this.scrapeTerms(termIds);
	}

	/**
	 * Get the list of all available terms given the starting url
	 * @param termsUrl the starting url to find the terms with v9
	 * @returns List of {termId, description}
	 */
	async getAllTermInfos(termsUrl: string): Promise<TermInfo[]> {
		// Query the Banner URL to get a list of the terms & parse
		const bannerTerms = await request.get({
			url: termsUrl,
			json: true,
			cache: false,
		});

		const termList = TermListParser.serializeTermsList(bannerTerms.body);

		// Sort by descending order (to get the most recent term IDs first)
		return termList.sort((a, b) => {
					return Number(b.termId) - Number(a.termId)
				}
		);
	}

	/**
	 * Given a list of all TermInfos, this function returns only those TermInfos for which we have data
	 * @param {*} allTermInfos A list of ALL term infos queried from Banner (ie. not filtered)
	 */
	async getCurrentTermInfos(allTermInfos: TermInfo[]): Promise<TermInfo[]> {
		// Get a list of termIDs (not termInfos!!) for which we already have data
		//  (ie. terms we've scraped, and that actually have data stored)
		const existingIds: string[] = (await prisma.course.groupBy({by: ["termId"]}))
		.map(t => t.termId);

		// Get the TermInfo associated with each term ID
		return existingIds
		.map(termId => allTermInfos.find(termInfo => termInfo.termId === termId))
		.filter(termInfo => termInfo !== undefined);
	}

	/**
	 * Scrape all the class data in a set of terms
	 * @param termIds array of terms to scrape in
	 * @returns Object {classes, sections} where classes is a list of class data
	 */
	async scrapeTerms(termIds: string[]): Promise<ParsedTermSR> {
		const termData: ParsedTermSR[] = await pMap(termIds, (p) => {
			return TermParser.parseTerm(p);
		});

		// Merges each ParsedTermSR into one big ParsedTermSR, containing all the data from each
		return termData.reduce((acc, cur) => {
			// Merge the two objects by keys
			return _.mergeWith(acc, cur, (a, b) => {
				if (Array.isArray(a)) {
					return a.concat(b);
				}
				return {...a, ...b};
			});
		}, {classes: [], sections: [], subjects: {}});

	}

	/**
	 * Scrape all the details of a specific class and associated sections
	 * @param termId termId the class is in
	 * @param subject the subject of the class ("CS")
	 * @param classId the course number of the class (2500)
	 * @returns Object {classes, sections} where classes and sections are arrays,
	 *          though classes should only have 1 element
	 */
	async scrapeClass(termId: string,
										subject: string,
										classId: string): Promise<{ classes: ParsedCourseSR[], sections: Section[] }> {
		const parsedClass = await ClassParser.parseClass(termId, subject, classId);
		const sections = await SectionParser.parseSectionsOfClass(termId, subject, classId);

		return {
			classes: (parsedClass === false) ? [] : [parsedClass],
			sections: (sections === false) ? [] : sections,
		};
	}

	// Just a convenient test method, if you want to
	async test(): Promise<void> {
		const numTerms = 20;
		const url = `https://nubanner.neu.edu/StudentRegistrationSsb/ssb/classSearch/getTerms?offset=1&max=${numTerms}&searchTerm=`;
		const termInfos = await this.getAllTermInfos(url);
		const output = await this.main(termInfos);
		// eslint-disable-next-line global-require
		require("fs").writeFileSync(
				"parsersxe.json",
				JSON.stringify(output, null, 4)
		);
	}
}


export const instance = new Bannerv9Parser();

if (require.main === module) {
	instance.test();
}
