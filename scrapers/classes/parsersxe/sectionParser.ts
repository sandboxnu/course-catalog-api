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
    classId: string
  ): Promise<false | Section[]> {
    const cookiejar = await util.getCookiesForSearch(termId);
    const req = await requestObj.get({
      url: "https://nubanner.neu.edu/StudentRegistrationSsb/ssb/searchResults/searchResults",
      qs: {
        txt_term: termId,
        txt_subject: subject,
        txt_courseNumber: classId,
        pageOffset: 0,
        pageMaxSize: 500,
      },
      jar: cookiejar,
      json: true,
    });

    if (req.body.success) {
      return req.body.data.map((sr) => {
        return this.parseSectionFromSearchResult(sr);
      });
    }
    return false;
  }

  getTermHalf(SR, termId) {
    if (SR.meetingsFaculty.length > 0) {
      try {
        const suffix = termId.substring(4);

        // NEU undergrad terms and law quarters are always full term
        if (
          ["10", "30", "40", "50", "60", "18", "28", "38", "58"].includes(
            suffix
          )
        ) {
          return "Full Term";
        }

        /*
      Term first half durations
      - CPS Fall Semester (14): Sept - Oct
      - Law Fall Semester (12): Sept - Oct
      - CPS Fall Quarter (15): Sept - Oct

      - CPS Winter Quarter (25): Jan - Feb

      - CPS Spring Semester (34): Jan - Mar
      - Law Spring Semester (32): Jan - Mar
      - CPS Spring Quarter (35): Apr - May

      - CPS Summer Semester (54): May - Jun
      - Law Summer Semester (52): May - Jun
      - CPS Summer Quarter (55): July - Aug

      Note: law quarters don't have half semesters
      */

        // maps a termid suffix to a list containing the start and end month for the first half of that term
        const firstHalfDatesMap = {
          14: ["09", "10"],
          12: ["09", "10"],
          15: ["09", "10"],
          25: ["01", "02"],
          34: ["01", "03"],
          32: ["01", "03"],
          35: ["04", "05"],
          54: ["05", "06"],
          52: ["05", "06"],
          55: ["07", "08"],
        };

        if (
          firstHalfDatesMap[suffix][0] ===
          SR.meetingsFaculty[0].meetingTime.startDate.substring(0, 2)
        ) {
          if (
            firstHalfDatesMap[suffix][1] ===
            SR.meetingsFaculty[0].meetingTime.endDate.substring(0, 2)
          ) {
            return "First Half";
          } else {
            return "Full Term";
          }
        } else {
          return "Second Half";
        }
      } catch (error) {
        console.log("im sad it got here");
        console.log(error);
      }
    }
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
        "https://wl11gp.neu.edu/udcprod8/bwckschd.p_disp_detail_sched" +
        `?term_in=${SR.term}&crn_in=${SR.courseReferenceNumber}`,
      profs: SR.faculty.map(MeetingParser.profName),
      meetings: MeetingParser.parseMeetings(SR.meetingsFaculty),
      termHalf: this.getTermHalf(SR, SR.term),
    };
  }
}

export default new SectionParser();
