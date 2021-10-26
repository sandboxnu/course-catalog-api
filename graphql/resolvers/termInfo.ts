import prisma from "../../services/prisma";

const getTermInfos = async (subCollege) => {
  return await prisma.termInfo.findMany({
    where: { subCollege: subCollege },
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
