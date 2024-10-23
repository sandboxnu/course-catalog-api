/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import Request from "../../request";
import util from "./util";
import MeetingParser from "./meetingParser";
import { SectionSR } from "../../../types/scraperTypes";
import { Section } from "../../../types/types";

const requestObj = new Request("sectionParser");

class SectionParser {
  async parseSectionsOfClass(
    termId: string,
    subject: string,
    classId: string,
  ): Promise<false | Section[]> {
    const cookieJar = await util.getCookiesForSearch(termId);
    const req = await requestObj.get(
      "https://nubanner.neu.edu/StudentRegistrationSsb/ssb/searchResults/searchResults",
      {
        searchParams: {
          txt_term: termId,
          txt_subject: subject,
          txt_courseNumber: classId,
          pageOffset: 0,
          pageMaxSize: 500,
        },
        cookieJar: cookieJar,
      },
    );

    const bodyObj = JSON.parse(req.body);
    if (bodyObj.success) {
      return bodyObj.data.map((sr) => {
        return this.parseSectionFromSearchResult(sr);
      });
    }
    return false;
  }

  /**
   * Search results already has all relevant section data
   * @param SR Section item from /searchResults
   */
  parseSectionFromSearchResult(SR: SectionSR): Section {
    return {
      host: "neu.edu",
      termId: SR.term,
      subject: SR.subject,
      classId: SR.courseNumber,
      crn: SR.courseReferenceNumber,
      seatsCapacity: SR.maximumEnrollment,
      seatsRemaining: SR.seatsAvailable,
      waitCapacity: SR.waitCapacity,
      waitRemaining: SR.waitAvailable,
      lastUpdateTime: Date.now(),
      classType: SR.scheduleTypeDescription,
      campus: SR.campusDescription,
      honors: SR.sectionAttributes.some((a) => {
        return a.description === "Honors";
      }),
      url:
        "https://bnrordsp.neu.edu/ssb-prod/bwckctlg.p_disp_course_detail?" +
        `cat_term_in=${SR.term}&subj_code_in=${SR.subject}&crse_numb_in=${SR.courseNumber}`,
      profs: SR.faculty.map(MeetingParser.profName),
      meetings: MeetingParser.parseMeetings(SR.meetingsFaculty),
    };
  }
}

export default new SectionParser();
