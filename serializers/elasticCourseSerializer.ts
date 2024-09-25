/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import CourseSerializer from "./courseSerializer";
import { ESCourse, ESSection } from "../types/serializerTypes";

class ElasticCourseSerializer extends CourseSerializer<ESCourse, ESSection> {
  courseProps(): string[] {
    return [];
  }

  finishCourseObj(course): ESCourse {
    const keys = ["host", "name", "subject", "classId", "termId", "nupath"];

    return keys.reduce((acc, key) => {
      if (key in course) {
        acc[key] = course[key];
      }
      return acc;
    }, {} as ESCourse);
  }

  finishSectionObj(section): ESSection {
    const keys = ["profs", "classType", "crn", "campus", "honors"];
    return keys.reduce((acc, key) => {
      if (key in section) {
        acc[key] = section[key];
      }
      return acc;
    }, {} as ESSection);
  }
}

export default ElasticCourseSerializer;
