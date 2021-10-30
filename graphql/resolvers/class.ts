/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import prisma from "../../services/prisma";
import HydrateCourseSerializer from "../../serializers/hydrateCourseSerializer";
import keys from "../../utils/keys";
import macros from "../../utils/macros";

const serializer = new HydrateCourseSerializer();

const serializeValues = (results) => {
  return results.map((result) => serializer.serializeCourse(result));
};

const getLatestClassOccurrence = async (subject, classId) => {
  const results = await prisma.course.findMany({
    where: { subject, classId },
    include: { sections: true },
    orderBy: { termId: "desc" },
  });
  return serializeValues(results)[0];
};

const getAllClassOccurrences = async (subject, classId) => {
  const results = await prisma.course.findMany({
    where: { subject, classId },
    include: { sections: true },
    orderBy: { termId: "desc" },
  });
  return serializeValues(results);
};

const getClassOccurrence = async (termId, subject, classId) => {
  const res = await prisma.course.findUnique({
    where: {
      uniqueCourseProps: { subject, classId, termId },
    },
    include: { sections: true },
  });

  return serializeValues([res])[0];
};

const getClassOccurrenceById = async (id) => {
  const res = await prisma.course.findUnique({
    where: { id },
  });

  return serializeValues([res])[0];
};

const getSectionById = async (id) => {
  const res = await prisma.section.findUnique({
    where: { id },
  });
  serializer.serializeSection(res);
  const { termId, subject, classId } = keys.parseSectionHash(id);
  return { termId, subject, classId, ...res };
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
