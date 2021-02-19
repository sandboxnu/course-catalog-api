/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import macros from "../../../utils/macros";
import keys from "../../../utils/keys";

class BaseProcessor {
  groupSectionsByClass(sections) {
    const classHash = {};

    sections.forEach((section) => {
      const obj = {
        host: section.host,
        termId: section.termId,
        subject: section.subject,
        classId: section.classId,
      };

      const hash = keys.getClassHash(obj);

      if (!classHash[hash]) {
        classHash[hash] = [];
      }

      classHash[hash].push(section);
    });

    return Object.values(classHash);
  }

  getClassHash(termDump) {
    // Make obj to find results here quickly.
    const keyToRows = {};

    termDump.classes.forEach((aClass) => {
      if (
        !aClass.host ||
        !aClass.termId ||
        !aClass.subject ||
        !aClass.classId
      ) {
        macros.error("ERROR class doesn't have required fields??", aClass);
        return;
      }

      // multiple classes could have same key
      const hash = keys.getClassHash(aClass);

      // only need to keep subject and classId
      keyToRows[hash] = aClass;
    });

    return keyToRows;
  }
}

BaseProcessor.prototype.BaseProcessor = BaseProcessor;
export default new BaseProcessor();
