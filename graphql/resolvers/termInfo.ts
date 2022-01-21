import prisma from "../../services/prisma";
import { TermInfo } from "../../types/types";

const getTermInfos = async (subCollege: string): Promise<TermInfo[]> => {
  return await prisma.termInfo.findMany({
    where: { subCollege: subCollege },
    orderBy: { termId: "desc" },
  });
};

const resolvers = {
  Query: {
    termInfos: async (parent, args) => {
      return getTermInfos(args.subCollege);
    },
  },
};

export default resolvers;
