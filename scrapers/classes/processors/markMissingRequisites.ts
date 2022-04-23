/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import macros from "../../../utils/macros";
import keys from "../../../utils/keys";
import simplifyRequirements from "./simplifyPrereqs";
import { ParsedCourseSR, ParsedTermSR } from "../../../types/scraperTypes";
import { isBooleanReq, isCourseReq, Requisite } from "../../../types/types";

// This file process the prereqs on each class and ensures that they point to other, valid classes.
// If they point to a class that does not exist, they are marked as missing.

export class MarkMissingRequisites {
  private classMap: Record<string, ParsedCourseSR> = {};

  main(termDump: ParsedTermSR): ParsedCourseSR[] {
    // Create a course mapping
    for (const singleClass of termDump.classes) {
      const key = keys.getClassHash(singleClass);
      this.classMap[key] = singleClass;
    }

    const updatedClasses: ParsedCourseSR[] = [];

    // loop through classes to update, and get the new data from all the classes
    for (const singleClass of termDump.classes) {
      if (singleClass.prereqs) {
        const prereqs = this.updatePrereqs(
          singleClass.prereqs,
          singleClass.host,
          singleClass.termId
        );

        // And simplify tree again
        singleClass.prereqs = simplifyRequirements(prereqs);
      }

      if (singleClass.coreqs) {
        const coreqs = this.updatePrereqs(
          singleClass.coreqs,
          singleClass.host,
          singleClass.termId
        );

        singleClass.coreqs = simplifyRequirements(coreqs);
      }

      if (singleClass.coreqs || singleClass.prereqs) {
        updatedClasses.push(singleClass);
      }
    }
    return updatedClasses;
  }

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
}

export const instance = new MarkMissingRequisites();
