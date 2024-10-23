/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import he from "he";
import cheerio from "cheerio";
import keys from "../../../utils/keys";
import Request from "../../request";
import PrereqParser from "./prereqParser";
import util from "./util";
import { getSubjectAbbreviations } from "./subjectAbbreviationParser";
import macros from "../../../utils/macros";
import { BooleanReq, CourseRef } from "../../../types/types";
import { CourseSR, ParsedCourseSR } from "../../../types/scraperTypes";

const request = new Request("classParser");

const collegeNames = {
  0: "NEU",
  2: "LAW",
  8: "LAW",
  4: "CPS",
  5: "CPS",
};

class ClassParser {
  /**
   * Build class data from scratch, sending a new search result query for this specific class.
   * @param termId term of class
   * @param subject subject code of class
   * @param classId course number of class
   */
  async parseClass(
    termId: string,
    subject: string,
    classId: string,
  ): Promise<false | ParsedCourseSR> {
    const cookieJar = await util.getCookiesForSearch(termId);
    const req = await request.get(
      "https://nubanner.neu.edu/StudentRegistrationSsb/ssb/courseSearchResults/courseSearchResults",
      {
        searchParams: {
          txt_term: termId,
          txt_subject: subject,
          txt_courseNumber: classId,
          startDatepicker: "",
          endDatepicker: "",
          pageOffset: 0,
          pageMaxSize: 1,
          sortColumn: "subjectDescription",
          sortDirection: "asc",
        },
        cookieJar: cookieJar,
      },
    );
    const bodyObj = JSON.parse(req.body);

    if (bodyObj.success && bodyObj.data && bodyObj.data[0]) {
      return this.parseClassFromSearchResult(bodyObj.data[0], termId);
    }
    return false;
  }

  /**
   * Build class data from search results and make additional requests as needed
   * @param SR Search result from /courseSearchResults (browse course catalog)
   * @param termId the termId that the class belongs to. Required cause searchresult doesn't include termid for some reason
   */
  async parseClassFromSearchResult(
    SR: CourseSR,
    termId: string,
  ): Promise<ParsedCourseSR> {
    const subjectAbbreviations = await getSubjectAbbreviations(termId);
    const { subjectCode, courseNumber } = SR;
    const description = await this.getDescription(
      termId,
      subjectCode,
      courseNumber,
    );
    const prereqs = await this.getPrereqs(
      termId,
      subjectCode,
      courseNumber,
      subjectAbbreviations,
    );
    const coreqs = await this.getCoreqs(
      termId,
      subjectCode,
      courseNumber,
      subjectAbbreviations,
    );
    const attributes = await this.getAttributes(
      termId,
      subjectCode,
      courseNumber,
    );
    const { amount: feeAmount, description: feeDescription } =
      await this.getFees(termId, subjectCode, courseNumber);
    // The type we have is basically an expanded Course
    const classDetails: ParsedCourseSR = {
      host: "neu.edu",
      termId: termId,
      subject: subjectCode,
      classId: courseNumber,
      classAttributes: attributes,
      nupath: this.nupath(attributes),
      desc: he.decode(description),
      prettyUrl:
        "https://bnrordsp.neu.edu/ssb-prod/bwckctlg.p_disp_course_detail?" +
        `cat_term_in=${termId}&subj_code_in=${subjectCode}&crse_numb_in=${courseNumber}`,
      name: he.decode(SR.courseTitle),
      url:
        "https://bnrordsp.neu.edu/ssb-prod/bwckctlg.p_disp_course_detail?" +
        `cat_term_in=${termId}&subj_code_in=${subjectCode}&crse_numb_in=${courseNumber}`,
      lastUpdateTime: Date.now(),
      maxCredits: SR.creditHourHigh || SR.creditHourLow,
      minCredits: SR.creditHourLow,
      college: collegeNames[termId.charAt(termId.length - 1)],
      feeAmount,
      feeDescription,
    };
    if (prereqs) {
      classDetails.prereqs = prereqs;
    }
    if (coreqs) {
      classDetails.coreqs = coreqs;
    }
    return classDetails;
  }

  async getDescription(
    termId: string,
    subject: string,
    classId: string,
  ): Promise<string> {
    const req = await this.courseSearchResultsPostRequest(
      "getCourseDescription",
      termId,
      subject,
      classId,
    );
    // Double decode the description, because banner double encodes the description :(
    return he.decode(he.decode(req.body.trim()));
  }

  async getPrereqs(
    termId: string,
    subject: string,
    classId: string,
    subjectAbbreviationTable: Record<string, string>,
  ): Promise<BooleanReq> {
    const req = await this.courseSearchResultsPostRequest(
      "getPrerequisites",
      termId,
      subject,
      classId,
    );
    return PrereqParser.serializePrereqs(req.body, subjectAbbreviationTable);
  }

  async getCoreqs(
    termId: string,
    subject: string,
    classId: string,
    subjectAbbreviationTable: Record<string, string>,
  ): Promise<BooleanReq> {
    const req = await this.courseSearchResultsPostRequest(
      "getCorequisites",
      termId,
      subject,
      classId,
    );
    return PrereqParser.serializeCoreqs(req.body, subjectAbbreviationTable);
  }

  async getAttributes(
    termId: string,
    subject: string,
    classId: string,
  ): Promise<string[]> {
    const req = await this.courseSearchResultsPostRequest(
      "getCourseAttributes",
      termId,
      subject,
      classId,
    );
    return this.serializeAttributes(req.body);
  }

  serializeAttributes(str: string): string[] {
    return he
      .decode(str)
      .split("<br/>")
      .map((a) => a.trim());
  }

  async getFees(
    termId: string,
    subject: string,
    classId: string,
  ): Promise<{ amount: number; description: string }> {
    const req = await this.courseSearchResultsPostRequest(
      "getFees",
      termId,
      subject,
      classId,
    );
    return this.parseFees(req.body);
  }

  parseFees(html: string): { amount: number; description: string } {
    const trimmed = html.trim();
    if (trimmed === "No fee information available.") {
      return { amount: null, description: "" };
    }

    const $ = cheerio.load(html);
    const table = $("table");
    const rows = util.parseTable(table);

    if (rows.length !== 1) {
      // We expect courses to have no fees or one fee
      macros.warn("UNEXPECTED COURSE FEE VALUE");
      return { amount: null, description: "" };
    }

    let amount = rows[0].amount;
    const description = rows[0].description;
    // Chop the "$" off the front and the ".00" off the end, remove ","s
    amount = amount.substring(1);
    amount = amount.substring(0, amount.indexOf("."));
    amount = amount.replace(",", "");
    return { amount: parseInt(amount, 10), description };
  }

  nupath(attributes: string[]): string[] {
    const regex = new RegExp("NUpath (.*?) *NC.{2}");
    return attributes.filter((a) => regex.test(a)).map((a) => regex.exec(a)[1]);
  }

  /**
   * Makes a POST request to
   * https://nubanner.neu.edu/StudentRegistrationSsb/ssb/courseSearchResults/<endpoint>
   * with the body
   * term=000000&subjectCode=XX&courseNumber=0000
   *
   * @param endpoint
   * @param termId
   * @param subject
   * @param classId
   */
  async courseSearchResultsPostRequest(
    endpoint: string,
    termId: string,
    subject: string,
    classId: string,
  ): Promise<{ body: string }> {
    /*
     * if the request fails because termId and/or crn are invalid,
     * request will retry 35 attempts before crashing.
     */
    return await request.post(
      `https://nubanner.neu.edu/StudentRegistrationSsb/ssb/courseSearchResults/${endpoint}`,
      {
        form: {
          term: termId,
          subjectCode: subject,
          courseNumber: classId,
        },
        cacheRequests: false,
      },
    );
  }

  getAllCourseRefs(course: ParsedCourseSR): Record<string, CourseRef> {
    const termId = course.termId;
    const prereqRefs = this.getRefsFromJson(course.prereqs, termId);
    const coreqRefs = this.getRefsFromJson(course.coreqs, termId);
    const prereqForRefs = this.getRefsFromJson(course.prereqsFor, termId);
    const optPrereqForRefs = this.getRefsFromJson(course.optPrereqsFor, termId);

    return {
      ...prereqRefs,
      ...coreqRefs,
      ...prereqForRefs,
      ...optPrereqForRefs,
    };
  }

  getRefsFromJson(obj, termId: string): Record<string, CourseRef> {
    if (!obj) return {};

    return obj.values.reduce((acc, val) => {
      if (val.type) {
        return { ...this.getRefsFromJson(val, termId), ...acc };
      }
      const { subject, classId } = val;
      if (!subject || !classId) {
        return acc;
      }
      return {
        ...acc,
        [keys.getClassHash({
          subject,
          classId,
          termId,
          host: "neu.edu",
        })]: { subject, classId, termId },
      };
    }, {});
  }
}

export default new ClassParser();
