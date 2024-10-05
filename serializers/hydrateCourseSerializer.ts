/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import CourseSerializer from "./courseSerializer";
import { Course, Section } from "../types/types";
import { SerializedSection } from "../types/serializerTypes";

class HydrateCourseSerializer extends CourseSerializer {
  static courseProps(): string[] {
    return ["lastUpdateTime", "termId", "host", "subject", "classId"];
  }

  static finishCourseObj(course: Course): Course {
    return course;
  }

  static finishSectionObj(section: SerializedSection): Section {
    // We know this will work, but Typescript doesn't
    //  In the main class, we add the fields from this.courseProps() to the section
    //  This creates a proper Section, but TS doesn't know we do that.
    const { id, classHash, ...rest } = section;
    return rest as unknown as Section;
  }
}

export default HydrateCourseSerializer;
