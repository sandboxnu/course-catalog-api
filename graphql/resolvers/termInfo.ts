import prisma from "../../services/prisma";
import { TermInfo } from "../../types/types";
import { TermInfo as PrismaTermInfo } from "@prisma/client";

const getTermInfos = async (subCollege: string): Promise<TermInfo> => {
  return (await prisma.termInfo.findMany({
    where: { subCollege: subCollege },
    orderBy: { termId: "desc" },
  })) as PrismaTermInfo;
};

const resolvers = {
  Query: {
    termInfos: async (parent, args) => {
      return getTermInfos(args.subCollege);
    },
  },
};

export default resolvers;
