/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import CourseSerializer from "./courseSerializer";
import { ESCourse, ESSection } from "../types/serializerTypes";

class ElasticCourseSerializer extends CourseSerializer<ESCourse, ESSection> {
  override courseProps(): string[] {
    return [];
  }

  override finishCourseObj(course: any): ESCourse {
    return {
      host: course["host"],
      name: course["name"],
      subject: course["subject"],
      classId: course["classId"],
      termId: course["termId"],
      nupath: course["nupath"],
    };
  }

  override finishSectionObj(section: any): ESSection {
    return {
      profs: section["profs"],
      classType: section["classType"],
      crn: section["crn"],
      campus: section["campus"],
      honors: section["honors"],
    };
  }
}

export default ElasticCourseSerializer;
