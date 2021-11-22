/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import macros from "../../../utils/macros";
import {BaseProcessor, instance as baseProcessor} from "./baseProcessor";
import keys from "../../../utils/keys";
import simplifyRequirements from "./simplifyPrereqs";
import {ParsedCourseSR, ParsedTermSR} from "../../../types/searchResultTypes";
import {CourseReq, isBooleanReq, isCourseReq, Requisite} from "../../../types/types";

// This file process the prereqs on each class and ensures that they point to other, valid classes.
// If they point to a class that does not exist, they are marked as missing.

export class MarkMissingPrereqs extends BaseProcessor {
  updatePrereqs(prereqs: Requisite, host: string, termId: string, keyToRows): Requisite {
    if (!(isBooleanReq(prereqs))) {
      return prereqs
    }

    for (let i = prereqs.values.length - 1; i >= 0; i--) {
      const prereqEntry = prereqs.values[i];

      // prereqEntry could be Object{subject:classId:} or string i think

      if (isCourseReq(prereqEntry)) {
        const hash = keys.getClassHash({
          host: host,
          termId: termId,
          subject: prereqEntry.subject,
          classId: prereqEntry.classId,
        });

        if (!keyToRows[hash]) {
          (prereqs.values[i] as CourseReq).missing = true;
        }
      }
      else if (isBooleanReq(prereqEntry)) {
        this.updatePrereqs(prereqEntry, host, termId, keyToRows);
      }
      else if (typeof prereqEntry !== 'string') {
        macros.error("wtf is ", prereqEntry, prereqs);
      }
    }
    return prereqs;
  }

  // base query is the key shared by all classes that need to be updated
  // if an entire college needs to be updated, it could be just {host:'neu.edu'}
  // at minimum it will be a host
  // or if just one class {host, termId, subject, classId}
  go(termDump: ParsedTermSR): ParsedCourseSR[] {
    const keyToRows = baseProcessor.getClassHash(termDump);

    const updatedClasses: ParsedCourseSR[] = [];

    // loop through classes to update, and get the new data from all the classes
    for (const aClass of termDump.classes) {
      if (aClass.prereqs) {
        const prereqs = this.updatePrereqs(
          aClass.prereqs,
          aClass.host,
          aClass.termId,
          keyToRows
        );

        // And simplify tree again
        aClass.prereqs = simplifyRequirements(prereqs);
      }

      if (aClass.coreqs) {
        const coreqs = this.updatePrereqs(
          aClass.coreqs,
          aClass.host,
          aClass.termId,
          keyToRows
        );
        aClass.coreqs = simplifyRequirements(coreqs);

        // Remove honors coreqs from classes that are not honors
        // This logic is currently in the frontend, but should be moved to the backend.
        // and remove non honors coreqs if there is a hon lab with the same classId
        // this isnt going to be 100% reliable across colleges, idk how to make it better, but want to error on the side of showing too many coreqs
      }
      if (aClass.coreqs || aClass.prereqs) {
        updatedClasses.push(aClass);
      }
    }
    return updatedClasses;
  }
}

export const instance = new MarkMissingPrereqs();

if (require.main === module) {
  instance.go({
    classes: [],
    sections: [],
    subjects: {}
  })
}
