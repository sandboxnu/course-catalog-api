/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import {
  Course as PrismaCourse,
  Section as PrismaSection,
} from "@prisma/client";
import prisma from "../../services/prisma";
import HydrateCourseSerializer from "../../serializers/hydrateCourseSerializer";
import keys from "../../utils/keys";
import { Course, Section } from "../../types/types";

const serializer = new HydrateCourseSerializer();

const serializeValues = (results: PrismaCourse[]): Course[] => {
  return results.map((result) => serializer.serializeCourse(result));
};

const getLatestClassOccurrence = async (
  subject: string,
  classId: string
): Promise<Course> => {
  const results: PrismaCourse[] = await prisma.course.findMany({
    where: { subject, classId },
    include: { sections: true },
    orderBy: { termId: "desc" },
  });
  return serializeValues(results)[0];
};

const getAllClassOccurrences = async (
  subject: string,
  classId: string
): Promise<Course[]> => {
  const results = await prisma.course.findMany({
    where: { subject, classId },
    include: { sections: true },
    orderBy: { termId: "desc" },
  });
  return serializeValues(results);
};

const getClassOccurrence = async (
  termId: string,
  subject: string,
  classId: string
): Promise<Course> => {
  const res: PrismaCourse = await prisma.course.findUnique({
    where: {
      uniqueCourseProps: { subject, classId, termId },
    },
    include: { sections: true },
  });

  return serializeValues([res])[0];
};

const getClassOccurrenceById = async (id: string): Promise<Course> => {
  const res: PrismaCourse = await prisma.course.findUnique({
    where: { id },
    include: { sections: true },
  });

  return serializeValues([res])[0];
};

const getSectionById = async (id: string): Promise<Section> => {
  const res: PrismaSection = await prisma.section.findUnique({
    where: { id },
  });
  const resSec: Section = serializer.serializeSection(res); // this mutates res
  const { termId, subject, classId } = keys.parseSectionHash(id);

  return { termId, subject, classId, ...resSec };
};

const resolvers = {
  Query: {
    class: (parent, args) => {
      return getLatestClassOccurrence(
        args.subject,
        args.classId && args.classId
      );
    },
    classByHash: (parent, args) => {
      return getClassOccurrenceById(args.hash);
    },
    sectionByHash: (parent, args) => {
      return getSectionById(args.hash);
    },
  },
  Class: {
    latestOccurrence: (clas) => {
      return getLatestClassOccurrence(clas.subject, clas.classId);
    },
    allOccurrences: (clas) => {
      return getAllClassOccurrences(clas.subject, clas.classId);
    },
    occurrence: (clas, args) => {
      return getClassOccurrence(args.termId, clas.subject, clas.classId);
    },
  },
};

export default resolvers;
