import prisma from "../../services/prisma";
import { Major as PrismaMajor } from "@prisma/client";
import { GraphQLError } from "graphql";

const noResultsError = (recordType): never => {
  throw new GraphQLError(`${recordType} not found!`, {
    extensions: {
      code: "BAD_USER_INPUT",
    },
  });
};

const getLatestMajorOccurrence = async (
  majorId: string,
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
