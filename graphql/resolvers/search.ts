import { identity, pickBy } from "lodash";
import searcher from "../../services/searcher";
import { Course, Employee } from "../../types/types";
import { AggResults, SearchResult } from "../../types/searchTypes";
import prisma from "../../services/prisma";
import { TermInfo } from "@prisma/client";
import { RssHandler } from "htmlparser2";

type SearchResultItem = Course | Employee;

interface SearchResultItemConnection {
  totalCount: number;
  pageInfo: {
    hasNextPage: boolean;
  };
  nodes: SearchResultItem[];
  filterOptions: AggResults;
  isCurrentTerm: boolean;
}
function determineIfCurrentTerm(maxEndDate: number): boolean {
  if (maxEndDate == -1) {
    return true;
  }
  const daysSinceEpoch = new Date().getTime();
  const currentDate = Math.floor(daysSinceEpoch / (1000 * 60 * 60 * 24));
  return maxEndDate > currentDate;
}
function determineMaxEndDate(resultSearch: SearchResult[]): number {
  let maxEndDate = -1;
  if (resultSearch) {
    for (const result of resultSearch) {
      if (result.type === "class") {
        for (const section of result.sections) {
          for (const meetings of section.meetings) {
            if (meetings.endDate > maxEndDate) {
              maxEndDate = meetings.endDate;
            }
          }
        }
      }
    }
  }
  return maxEndDate;
}
async function updateMaxEndDate(termIdString: string, maxEndDate: number) {
  const updatedMaxEndDate = await prisma.termInfo.update({
    where: { termId: termIdString },
    data: { maxEndDate: maxEndDate },
  });
}
interface SearchArgs {
  termId: string;
  query?: string;
  subject?: string[];
  nupath?: string[];
  campus?: string[];
  classType?: string[];
  classIdRange?: { min: number; max: number };
  honors?: boolean;
  // Pagination parameters
  offset?: number;
  first?: number;
}
const resolvers = {
  Query: {
    search: async (
      parent,
      args: SearchArgs
    ): Promise<SearchResultItemConnection> => {
      const { offset = 0, first = 10 } = args;
      const results = await searcher.search(
        args.query || "",
        args.termId,
        offset,
        offset + first,
        pickBy(
          {
            subject: args.subject,
            nupath: args.nupath,
            campus: args.campus,
            classType: args.classType,
            classIdRange: args.classIdRange,
            honors: args.honors,
          },
          identity
        )
      );

      const termInfo: TermInfo = await prisma.termInfo.findFirst({
        where: { termId: "" + args.termId },
      });
      const maxEndDate = determineMaxEndDate(results.searchContent);
      // if (termInfo){

      // }
      // if (termInfo?.maxEndDate) {
      //   updateMaxEndDate(args.termId, maxEndDate);
      // }
      const hasNextPage = offset + first < results.resultCount;

      const isCurrentTerm: boolean = determineIfCurrentTerm(maxEndDate);
      return {
        totalCount: results.resultCount,
        nodes: results.searchContent.map((r) =>
          r.type === "employee"
            ? r.employee
            : { ...r.class, sections: r.sections }
        ),
        pageInfo: {
          hasNextPage,
        },
        filterOptions: results.aggregations,
        isCurrentTerm,
      };
    },
  },

  SearchResultItem: {
    __resolveType(obj: SearchResultItem) {
      return "firstName" in obj ? "Employee" : "ClassOccurrence";
    },
  },
};

export default resolvers;
