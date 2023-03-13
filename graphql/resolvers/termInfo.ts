import prisma from "../../services/prisma.js";
import { TermInfo } from "../../types/types.js";

type TermInfoCache = Record<
  string,
  {
    termInfos: TermInfo[];
    lastUpdated: number;
  }
>;

/**
 * This mechanism caches the list of terms for each subcollege.
 * This list is only updated when new semesters are released (ie. 2-4 times a year)
 *
 * Every time a user first loads the SearchNEU page, they need to know which semesters are available. It makes no
 *  sense to query Postgres every time - this isn't a scalable method, as Prisma (and psql) limit the number of connections.
 * Instead, we can cache the list of terms, only updating it every once in a while (and not on a user-by-user basis)
 */
const TERM_INFO_CACHE: TermInfoCache = {};

// How long should it take for the cache to be declared stale and re-fetched, in ms? (currently 2 hours)
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
