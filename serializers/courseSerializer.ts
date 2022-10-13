/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import prisma from "../services/prisma";
import { Course, Section } from "../types/types";
import { Section as PrismaSection } from "@prisma/client";
import {
  PrismaCourseWithSections,
  SerializedCourse,
  SerializedSection,
} from "../types/serializerTypes";
import keys from "../utils/keys";

/* The type of this class is complicated by the fact that this needs to support Course, and also
  a slim version of Course for elasticsearch.

  So, the course we take has to be a subset of Course.
  The section we take has to be a subset of Section
 */
abstract class CourseSerializer<
  C extends Partial<Course>,
  S extends Partial<Section>
> {
  // FIXME this pattern is bad
  async bulkSerialize(
    instances: PrismaCourseWithSections[],
    all = false
  ): Promise<Record<string, SerializedCourse<C, S>>> {
    const courses = instances.map((course) => {
      return this.serializeCourse(course);
    });

    let sections: PrismaSection[] | undefined;

    if (all) {
      sections = await prisma.section.findMany();
    } else {
      sections = await prisma.section.findMany({
        where: {
          classHash: {
            in: instances.slice(0, 100).map((instance) => instance.id),
          },
        },
      });
    }

    // Build a map from each sections' class hash to a list of corresponding sections
    const classToSections: Record<string, PrismaSection[]> = sections.reduce<
      Record<string, PrismaSection[]>
    >((classToSections, section) => {
      if (section.classHash in classToSections) {
        classToSections[section.classHash].push(section);
      } else {
        classToSections[section.classHash] = [section];
      }
      return classToSections;
    }, {});

    // Wrap the existing class hashing function to accept a course
    const getClassHash = (course: C) =>
      keys.getClassHash({
        host: "neu.edu",
        termId: course.termId,
        subject: course.subject,
        classId: course.classId,
      });

    // Build a map from each courses' hash to its own serialized course object
    return courses.reduce((record, course) => {
      record[getClassHash(course)] = this.bulkSerializeCourse(
        course,
        classToSections[getClassHash(course)] || []
      );
      return record;
    }, {});
  }

  bulkSerializeCourse(
    course: C,
    sections: PrismaSection[]
  ): SerializedCourse<C, S> {
    const serializedSections = this.serializeSections(sections, course);

    return {
      class: course,
      sections: serializedSections,
      type: "class",
    };
  }

  serializeSections(
    sections: PrismaSection[],
    parentCourse: C
  ): (S & Partial<C>)[] {
    if (sections.length === 0) return [];

    return sections
      .map((section) => {
        return this.serializeSection(section);
      })
      .map((section) => {
        return {
          ...section,
          ...this.courseProps().reduce<Partial<C>>(
            (acc, prop) =>
              prop in parentCourse
                ? { ...acc, [prop]: parentCourse[prop] }
                : acc,
            {}
          ),
        };
      });
  }

  serializeCourse(course: PrismaCourseWithSections): C {
    return this._serializeCourse(course);
  }

  /* We have this method because:
    - We want to preserve types, so external functions know what we expect
    - We want to convert an object from one type to another IN-PLACE

    So, we have an external-facing method with a type, and this internal method with type any.
    This allows us to ensure that the argument is still of the expected type, AND to modify
      the object to another type in-place.
   */
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  private _serializeCourse(innerCourse: any): C {
    innerCourse.lastUpdateTime = innerCourse.lastUpdateTime.getTime();
    innerCourse.desc = innerCourse.description;

    if (innerCourse.sections) {
      innerCourse.sections = innerCourse.sections.map((section) =>
        this.serializeSection(section)
      );
    }
    return this.finishCourseObj(innerCourse);
  }

  serializeSection(section: PrismaSection): S {
    return this._serializeSection(section);
  }

  // See _serializeCourse for an explanation of this pattern.
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  private _serializeSection(section: any): S {
    section.lastUpdateTime = section.lastUpdateTime.getTime();
    return this.finishSectionObj(section);
  }

  abstract courseProps(): string[];

  abstract finishCourseObj(course: Course): C;

  abstract finishSectionObj(section: SerializedSection): S;
}

export default CourseSerializer;
