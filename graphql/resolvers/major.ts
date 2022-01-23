import { UserInputError } from "apollo-server";
import prisma from "../../services/prisma";
import { Major as PrismaMajor } from "@prisma/client";

const noResultsError = (recordType): never => {
  throw new UserInputError(`${recordType} not found!`);
};

const getLatestMajorOccurrence = async (
  majorId: string
): Promise<PrismaMajor> => {
  const majors: PrismaMajor[] = await prisma.major.findMany({
    where: { majorId: majorId },
    orderBy: { yearVersion: "desc" },
    take: 1,
  });

  return majors[0] || noResultsError("major");
};

const resolvers = {
  Query: {
    major: (parent, args) => {
      return getLatestMajorOccurrence(args.majorId);
    },
  },
  Major: {
    occurrence: async (major, args) => {
      const majors = await prisma.major.findMany({
        where: { majorId: major.majorId, yearVersion: `${args.year}` },
        take: 1,
      });

      return majors[0] || noResultsError("occurrence");
    },
    latestOccurrence: (major) => {
      return getLatestMajorOccurrence(major.majorId);
    },
  },
};

export default resolvers;
