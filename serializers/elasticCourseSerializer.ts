/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import _ from "lodash";

import CourseSerializer from "./courseSerializer";
import { ESCourse, ESSection } from "../types/serializerTypes";

class ElasticCourseSerializer extends CourseSerializer<ESCourse, ESSection> {
  courseProps(): string[] {
    return [];
  }

  finishCourseObj(course): ESCourse {
    return _.pick(course, [
      "host",
      "name",
      "subject",
      "classId",
      "termId",
      "nupath",
    ]);
  }

  finishSectionObj(section): ESSection {
    return _.pick(section, ["profs", "classType", "crn", "campus", "termHalf"]);
  }
}

export default ElasticCourseSerializer;
