/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import macros from "../../../utils/macros.js";
import keys from "../../../utils/keys.js";
import simplifyRequirements from "./simplifyPrereqs.js";
import { ParsedCourseSR, ParsedTermSR } from "../../../types/scraperTypes.js";
import { isBooleanReq, isCourseReq, Requisite } from "../../../types/types.js";

// This file process the prereqs on each class and ensures that they point to other, valid classes.
// If they point to a class that does not exist, they are marked as missing.

export class MarkMissingRequisites {
  private classMap: Record<string, ParsedCourseSR> = {};

  updatePrereqs(prereqs: Requisite, host: string, termId: string): Requisite {
    if (!isBooleanReq(prereqs)) {
      return prereqs;
    }

    for (const prereqEntry of prereqs.values) {
      if (isCourseReq(prereqEntry)) {
        const hash = keys.getClassHash({
          host: host,
          termId: termId,
          subject: prereqEntry.subject,
          classId: prereqEntry.classId,
        });

        if (!this.classMap[hash]) {
          prereqEntry.missing = true;
        }
      } else if (isBooleanReq(prereqEntry)) {
        this.updatePrereqs(prereqEntry, host, termId);
      } else if (typeof prereqEntry !== "string") {
        macros.error("wtf is ", prereqEntry, prereqs);
      }
    }
    return prereqs;
  }

  go(termDump: ParsedTermSR): ParsedCourseSR[] {
    // Create a course mapping
    for (const aClass of termDump.classes) {
      const key = keys.getClassHash(aClass);
      this.classMap[key] = aClass;
    }

    const updatedClasses: ParsedCourseSR[] = [];

    // loop through classes to update, and get the new data from all the classes
    for (const aClass of termDump.classes) {
      if (aClass.prereqs) {
        const prereqs = this.updatePrereqs(
          aClass.prereqs,
          aClass.host,
          aClass.termId
        );

        // And simplify tree again
        aClass.prereqs = simplifyRequirements(prereqs);
      }

      if (aClass.coreqs) {
        const coreqs = this.updatePrereqs(
          aClass.coreqs,
          aClass.host,
          aClass.termId
        );

        aClass.coreqs = simplifyRequirements(coreqs);
      }

      if (aClass.coreqs || aClass.prereqs) {
        updatedClasses.push(aClass);
      }
    }
    return updatedClasses;
  }
}

export default new MarkMissingRequisites();
