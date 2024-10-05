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

/* The type of this class is complicated by the fact that this needs to support Course, and also
  a slim version of Course for elasticsearch.

  So, the course we take has to be a subset of Course.
  The section we take has to be a subset of Section
 */
class CourseSerializer {
  static async bulkSerialize<
    C extends Partial<Course>,
    S extends Partial<Section>
  >(
    instances: PrismaCourseWithSections[],
    all = false
  ): Promise<Record<string, SerializedCourse<C, S>>> {
    const courses = instances.map((course) => {
      return this.serializeCourse<C>(course);
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

    const classToSections: Record<string, PrismaSection[]> = sections?.reduce(
      (acc, section) => {
        if (!acc[section.classHash]) {
          acc[section.classHash] = [];
        }
        acc[section.classHash].push(section);
        return acc;
      },
      {}
    );

    return Object.fromEntries(
      courses.map((course) => [
        this.getClassHash(course),
        this.bulkSerializeCourse<C, S>(
          course,
          classToSections[this.getClassHash(course)] || []
        ),
      ])
    );
  }

  static bulkSerializeCourse<C, S>(
    course: C,
    sections: PrismaSection[]
  ): SerializedCourse<C, S> {
    const serializedSections = this.serializeSections<S>(sections, course);

    return {
      class: course,
      sections: serializedSections,
      type: "class",
    };
  }

  static serializeSections<S>(
    sections: PrismaSection[],
    parentCourse: Partial<Course>
  ): (S & Partial<Course>)[] {
    if (sections.length === 0) return [];

    return sections
      .map((section) => {
        return this.serializeSection(section) as S;
      })
      .map((section) => {
        const picked: Partial<Course> = this.courseProps().reduce(
          (acc, key) => {
            if (key in parentCourse) {
              acc[key] = parentCourse[key];
            }
            return acc;
          },
          {}
        );

        return { ...section, ...picked } as S & Partial<Course>;
      });
  }

  static serializeCourse<C>(course: PrismaCourseWithSections): C {
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
  private static _serializeCourse(innerCourse: any): any {
    innerCourse.lastUpdateTime = innerCourse.lastUpdateTime.getTime();
    innerCourse.desc = innerCourse.description;

    if (innerCourse.sections) {
      innerCourse.sections = innerCourse.sections.map((section) =>
        this.serializeSection(section)
      );
    }
    return this.finishCourseObj(innerCourse);
  }

  static serializeSection<S>(section: PrismaSection): S {
    return this._serializeSection(section);
  }

  // See _serializeCourse for an explanation of this pattern.
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  private static _serializeSection(section: any): any {
    section.lastUpdateTime = section.lastUpdateTime.getTime();
    return this.finishSectionObj(section);
  }

  // TODO this should definitely be eliminated
  static getClassHash(course: Partial<Course>): string {
    return ["neu.edu", course.termId, course.subject, course.classId].join("/");
  }

  static courseProps(): string[] {
    throw new Error("not implemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static finishCourseObj(_: Course): Partial<Course> {
    throw new Error("not implemented");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static finishSectionObj(_: SerializedSection): Partial<Section> {
    throw new Error("not implemented");
  }
}

export default CourseSerializer;
