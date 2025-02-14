/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import prisma from "../../services/prisma.ts";
import HydrateCourseSerializer from "../../serializers/hydrateCourseSerializer.ts";
import keys from "../../utils/keys.ts";
import {
  Course as PrismaCourse,
  Section as PrismaSection,
} from "@prisma/client";
import { Course, Section } from "../../types/types.ts";
import { GraphQLError } from "graphql";

const serializer = new HydrateCourseSerializer();

const serializeValues = (results: PrismaCourse[]): Course[] => {
  return results.map((result) => serializer.serializeCourse(result));
};

const getLatestClassOccurrence = async (
  subject: string,
  classId: string,
): Promise<Course> => {
  const result: PrismaCourse | null = await prisma.course.findFirst({
    where: { subject, classId },
    include: { sections: true },
    orderBy: { termId: "desc" },
  });

  if (result === null) {
    throw new GraphQLError(
      `We couldn't find any occurrences of a class with subject '${subject}' and class ID '${classId}'`,
      {
        extensions: {
          code: "COURSE_NOT_FOUND",
        },
      },
    );
  }

  return serializer.serializeCourse(result);
};

const getBulkClassOccurrences = async (
  input: Array<{
    subject: string;
    classId: string;
  }>,
): Promise<Course[]> => {
  const results: PrismaCourse[] = await prisma.course.findMany({
    where: { OR: input },
    orderBy: { termId: "desc" },
    distinct: ["classId", "subject"],
  });
  return serializeValues(results);
};

const getAllClassOccurrences = async (
  subject: string,
  classId: string,
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
  classId: string,
): Promise<Course> => {
  const result: PrismaCourse | null = await prisma.course.findUnique({
    where: {
      uniqueCourseProps: { subject, classId, termId },
    },
    include: { sections: true },
  });

  if (result === null) {
    throw new GraphQLError(
      `We couldn't find a course matching the term '${termId}', subject '${subject}', and class ID '${classId}'`,
      {
        extensions: {
          code: "COURSE_NOT_FOUND",
        },
      },
    );
  }

  return serializer.serializeCourse(result);
};

const getClassOccurrenceById = async (id: string): Promise<Course> => {
  const result: PrismaCourse | null = await prisma.course.findUnique({
    where: { id },
    include: { sections: true },
  });

  if (result === null) {
    throw new GraphQLError(
      `We couldn't find a course matching the hash '${id}'`,
      {
        extensions: {
          code: "COURSE_NOT_FOUND",
        },
      },
    );
  }
  return serializer.serializeCourse(result);
};

const getSectionById = async (id: string): Promise<Section> => {
  const result: PrismaSection | null = await prisma.section.findUnique({
    where: { id },
  });

  if (result === null) {
    throw new GraphQLError(
      `We couldn't find a section matching the hash '${id}'`,
      {
        extensions: {
          code: "SECTION_NOT_FOUND",
        },
      },
    );
  }

  const resSec: Section = serializer.serializeSection(result); // this mutates res
  const { termId, subject, classId } = keys.parseSectionHash(id);

  return { termId, subject, classId, ...resSec };
};

const resolvers = {
  Query: {
    class: (parent, args) => {
      return getLatestClassOccurrence(args.subject, args.classId);
    },
    bulkClasses: (parent, args) => {
      return getBulkClassOccurrences(args.input);
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
