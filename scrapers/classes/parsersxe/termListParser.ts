/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import { TermInfo } from "../../../types/types";

class TermListParser {
  serializeTermsList(
    termsFromBanner: { code: string; description: string }[]
  ): TermInfo[] {
    const activeTermInfos = termsFromBanner.filter(
      (term) => !term.description.includes("View Only")
    );
    const activeTermIds = activeTermInfos.map((termInfo) =>
      Number(termInfo.code)
    );
    /* The smallest active termInfo code. 
    All termInfo's with codes greater than or equal to this are considered active.*/
    const minActiveTermInfoCode = Math.min(...activeTermIds);
    return termsFromBanner.map((term) => {
      const subCollege = this.determineSubCollegeName(term.description);

      /* This removes any instance of 'Law ', 'CPS ', and ' (View Only)'
      These strings are unnecessary (for LAW and CPS, the subCollege tells us all we need) */
      const text = term.description.replace(
        /(Law\s|CPS\s)|\s\(View Only\)/gi,
        ""
      );

      return {
        host: "neu.edu",
        termId: term.code,
        text: text,
        subCollege: subCollege,
        active: Number(term.code) >= minActiveTermInfoCode,
      };
    });
  }

  /**
   * "Spring 2019 Semester" -> "NEU"
   * "Spring 2019 Law Quarter" -> "LAW"
   * "Spring 2019 CPS Quarter" -> "CPS"
   *
   * @param termDesc
   * @returns {string}
   */
  determineSubCollegeName(termDesc: string): string {
    if (termDesc.includes("CPS")) {
      return "CPS";
    } else if (termDesc.includes("Law")) {
      return "LAW";
    } else {
      return "NEU";
    }
  }
}

export default new TermListParser();
