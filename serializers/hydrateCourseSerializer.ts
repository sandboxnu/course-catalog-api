/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import _ from "lodash";
import CourseSerializer from "./courseSerializer.js";
import { Course, Section } from "../types/types.js";
import { SerializedSection } from "../types/serializerTypes.js";

class HydrateCourseSerializer extends CourseSerializer<Course, Section> {
  courseProps(): string[] {
    return ["lastUpdateTime", "termId", "host", "subject", "classId"];
  }

  finishCourseObj(course: Course): Course {
    return course;
  }

  finishSectionObj(section: SerializedSection): Section {
    // We know this will work, but Typescript doesn't
    //  In the main class, we add the fields from this.courseProps() to the section
    //  This creates a proper Section, but TS doesn't know we do that.
    return _.omit(section, ["id", "classHash"]) as unknown as Section;
  }
}

export default HydrateCourseSerializer;
