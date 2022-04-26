/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import keys from "../../../utils/keys";
import macros from "../../../utils/macros";
import { isCourseReq, Requisite } from "../../../types/types";
import { ParsedCourseSR, ParsedTermSR } from "../../../types/scraperTypes";

/**
 * Adds the prerequisite-for field for classes that are a predecessor for other classes.
 * As an example:
 * - One of CS2510's prerequisites is CS2500
 *    - So, if we look at the CS2510 course object, we know this
 *    - But, looking at the CS2500 object, we don't
 *
 * So, this adds:
 *  - CS2500 is a prerequisite for CS2510
 */
class AddPrerequisiteFor {
  private classMap: Record<string, ParsedCourseSR> = {};

  /**
   * Creates a class hashmap based on the term dump, then links the course data
   */
  go(termDump: ParsedTermSR): void {
    // Maps the class objects first
    for (const aClass of termDump.classes) {
      const key = keys.getClassHash(aClass);
      this.classMap[key] = aClass;

      // Reset all the prereqsFor arrays at the beginning of each time this is ran over a termDump.
      // Creates the fields 'optPrereqsFor' and 'prereqsFor'
      aClass.optPrereqsFor = { values: [] };
      aClass.prereqsFor = { values: [] };
    }

    // After all class objects are mapped, it associated prerequisite relationships
    for (const aClass of termDump.classes) {
      if (aClass.prereqs) {
        this.parsePrereqs(aClass, aClass.prereqs, true);
      }
    }

    // After the relations are mapped, we sort the classes
    for (const aClass of termDump.classes) {
      this.sortPrereqs(aClass);
    }
  }

  /**
   * Recursively traverse the prerequisite structure.
   * If the course has a prereq, we add this class to the prereq's optPrereqFor field.
   */
  parsePrereqs(
    mainClass: ParsedCourseSR,
    requisite: Requisite,
    isRequired: boolean
  ): void {
    if (
      typeof requisite === "string" ||
      (isCourseReq(requisite) && requisite.missing)
    ) {
      return;
    }

    // Get the class we wish to refer to
    if (isCourseReq(requisite)) {
      const hash = keys.getClassHash(mainClass);
      const nodeRef = this.classMap[hash];

      if (!nodeRef) {
        macros.error("Unable to find ref for", hash, requisite, mainClass);
        return;
      }

      const classData = {
        subject: mainClass.subject,
        classId: mainClass.classId,
      };

      if (isRequired) {
        nodeRef.prereqsFor.values.unshift(classData);
      } else {
        nodeRef.optPrereqsFor.values.unshift(classData);
      }
    } else {
      const classType = requisite.type;

      if (requisite.values !== undefined) {
        requisite.values.map((course) => {
          // A required course becomes effectively optional when we encounter an 'or' in our tree.
          const reqType = classType === "and" ? isRequired : false;
          return this.parsePrereqs(mainClass, course, reqType);
        });
      }
    }
  }

  // Sorts the prereqs in alphabetical order, except for courses matching the subject of our main class
  // If two classes have the same subject, they are sorted by classId
  sortPrereqsValues(matchingSubject: string, values: Requisite[]): Requisite[] {
    return values.sort((a, b) => {
      if (!(isCourseReq(a) && isCourseReq(b))) {
        return 0;
      }

      if (a.subject !== b.subject) {
        if (a.subject === matchingSubject) {
          return -1;
        }
        if (b.subject === matchingSubject) {
          return 1;
        }
        if (a.subject < b.subject) {
          return -1;
        }
        if (a.subject > b.subject) {
          return 1;
        }
      }

      const firstId = Number.parseInt(a.classId);
      const secondId = Number.parseInt(b.classId);

      if (firstId < secondId) {
        return -1;
      } else if (firstId > secondId) {
        return 1;
      } else {
        return 0;
      }
    });
  }

  // Recursively traverse the prerequisite structure of the given course and sorts
  sortPrereqs(aClass: ParsedCourseSR): void {
    if (aClass.optPrereqsFor && aClass.optPrereqsFor.values) {
      aClass.optPrereqsFor.values = this.sortPrereqsValues(
        aClass.subject,
        aClass.optPrereqsFor.values
      );
    }

    if (aClass.prereqsFor && aClass.prereqsFor.values) {
      aClass.prereqsFor.values = this.sortPrereqsValues(
        aClass.subject,
        aClass.prereqsFor.values
      );
    }
  }
}

export default new AddPrerequisiteFor();
