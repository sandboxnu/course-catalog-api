/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import prisma from "../services/prisma.js";
import HydrateCourseSerializer from "./hydrateCourseSerializer.js";
import HydrateProfSerializer from "./hydrateProfSerializer.js";
import {
  Course as PrismaCourse,
  Professor as PrismaProfessor,
} from "@prisma/client";
import {
  CourseSearchResult,
  ProfessorSearchResult,
  SearchResult,
} from "../types/searchTypes.js";

class HydrateSerializer {
  courseSerializer: HydrateCourseSerializer;
  profSerializer: HydrateProfSerializer;

  constructor() {
    this.courseSerializer = new HydrateCourseSerializer();
    this.profSerializer = new HydrateProfSerializer();
  }

  async bulkSerialize(instances: any[]): Promise<SearchResult[]> {
    const profs = instances.filter((instance) => {
      return instance._source.type === "employee";
    });

    const courses = instances.filter((instance) => {
      return instance._source.type === "class";
    });

    const profData: PrismaProfessor[] = await prisma.professor.findMany({
      where: {
        id: {
          in: profs.map((prof) => prof._id),
        },
      },
    });

    const courseData: PrismaCourse[] = await prisma.course.findMany({
      where: {
        id: {
          in: courses.map((course) => course._id),
        },
      },
    });

    const serializedProfs = (await this.profSerializer.bulkSerialize(
      profData
    )) as Record<string, ProfessorSearchResult>;

    const serializedCourses = (await this.courseSerializer.bulkSerialize(
      courseData
    )) as Record<string, CourseSearchResult>;

    const serializedResults = { ...serializedProfs, ...serializedCourses };
    return instances
      .map((instance) => serializedResults[instance._id])
      .filter((elem) => elem);
  }
}

export default HydrateSerializer;
