/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import keys from "../../../utils/keys";
``;
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
  private classMap = {};

  /**
   * Creates a class hashmap based on the term dump, then links the course data
   */
  main(termDump: ParsedTermSR): void {
    // Maps the class objects first
    for (const singleClass of termDump.classes) {
      const key = keys.getClassHash(singleClass);
      this.classMap[key] = singleClass;

      // Reset all the prereqsFor arrays at the beginning of each time this is ran over a termDump.
      // Creates the fields 'optPrereqsFor' and 'prereqsFor'
      singleClass.optPrereqsFor = { values: [] };
      singleClass.prereqsFor = { values: [] };
    }

    // After all class objects are mapped, it associated prerequisite relationships
    for (const singleClass of termDump.classes) {
      if (singleClass.prereqs) {
        this.parsePrereqs(singleClass, singleClass.prereqs, true);
      }
    }

    // After the relations are mapped, we sort the classes
    for (const singleClass of termDump.classes) {
      this.sortPreReqs(singleClass);
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
      const classHash = keys.getClassHash(mainClass);
      const classRef = this.classMap[classHash];

      if (!classRef) {
        macros.error("Unable to find ref for", classHash, requisite, mainClass);
        return;
      }

      const classData = {
        subject: mainClass.subject,
        classId: mainClass.classId,
      };

      if (isRequired) {
        classRef.prereqsFor.values.unshift(classData);
      } else {
        classRef.optPrereqsFor.values.unshift(classData);
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

  /**
   * Recursively traverse the prerequisite structure.
   */
  sortPreReqs(mainClass: ParsedCourseSR): void {
    if (mainClass.optPrereqsFor && mainClass.optPrereqsFor.values) {
      mainClass.optPrereqsFor.values = this.sortPrereqsValues(
        mainClass.subject,
        mainClass.optPrereqsFor.values
      );
    }

    if (mainClass.prereqsFor && mainClass.prereqsFor.values) {
      mainClass.prereqsFor.values = this.sortPrereqsValues(
        mainClass.subject,
        mainClass.prereqsFor.values
      );
    }
  }
}

const instance = new AddPrerequisiteFor();
export default instance;
