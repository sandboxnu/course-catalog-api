import { identity, pickBy } from "lodash";
import searcher from "../../services/searcher";
import { Course, Employee } from "../../types/types";
import { AggResults, SearchResult } from "../../types/searchTypes";

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
function determineIfCurrentTerm(
  termId: number,
  resultSearch: SearchResult[]
  //resultSearch: Employee | { Course; Section }
): boolean {
  // Fall: 9/20
  // if the greatest end date is smaller than where we are currently, don't have notifications
  // otherwise put: if we are past the date of the semester, no notifications needed
  // (e.g today is 9/20/22 semester ends 8/30/22) => no notifications
  const termIdStringify: String = termId.toString();
  const termIdYear: Number = +termIdStringify.substring(0, 4);

  const date = new Date().getTime();
  const currentDate = Math.floor(date / 8.64e7);

  let maxEndDate: number = 0;
  for (let result of resultSearch) {
    if (result.type === "class") {
      if (
        result.sections != null &&
        result.sections[0].meetings != null &&
        result.sections[0].meetings[0].endDate > maxEndDate
      ) {
        maxEndDate = result.sections[0].meetings[0].endDate;
      }
    }
  }
  if (maxEndDate < currentDate) {
    return false;
  }
  return true;
}
interface SearchArgs {
  termId: number;
  query?: string;
  subject?: string[];
  nupath?: string[];
  campus?: string[];
  classType?: string[];
  classIdRange?: { min: number; max: number };
  honors?: boolean;
  // Pagination parameters
  offset: number;
  first: number;
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
        String(args.termId),
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

      const hasNextPage = offset + first < results.resultCount;
      const nodes = results.searchContent.map((r) =>
        r.type === "employee"
          ? r.employee
          : { ...r.class, sections: r.sections }
      );

      const isCurrentTerm: boolean = determineIfCurrentTerm(
        args.termId,
        results.searchContent
      );
      return {
        totalCount: results.resultCount,
        nodes: nodes,
        pageInfo: {
          hasNextPage,
        },
        filterOptions: results.aggregations,
        isCurrentTerm: isCurrentTerm,
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
