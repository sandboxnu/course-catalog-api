import prisma from "../../services/prisma";
import { TermInfo } from "../../types/types";

type TermInfoCache = Record<
  string,
  {
    termInfos: TermInfo[];
    lastUpdated: number;
  }
>;

const TERM_INFO_CACHE: TermInfoCache = {};

// How long should it take for the cache to be declared stale and re-fetched? 2 hours
const CACHE_REFRESH_INTERVAL = 2 * 60 * 60 * 1000;

// Checks if the cache is valid, or if it's time to revalidate and fetch from the database
function isCacheValid(subCollege: string): boolean {
  if (subCollege in TERM_INFO_CACHE) {
    return (
      TERM_INFO_CACHE[subCollege].lastUpdated + CACHE_REFRESH_INTERVAL >
      Date.now()
    );
  }
  return false;
}

const getTermInfos = async (subCollege: string): Promise<TermInfo[]> => {
  if (isCacheValid(subCollege)) {
    return TERM_INFO_CACHE[subCollege].termInfos;
  } else {
    // Cache is invalid (or doesn't exist yet), so we fetch from the database and cache it
    const termInfos = await prisma.termInfo.findMany({
      where: { subCollege: subCollege },
      orderBy: { termId: "desc" },
    });

    TERM_INFO_CACHE[subCollege] = {
      termInfos,
      lastUpdated: Date.now(),
    };

    return termInfos;
  }
};

const resolvers = {
  Query: {
    termInfos: async (parent, args) => {
      return getTermInfos(args.subCollege);
    },
  },
};

export default resolvers;
