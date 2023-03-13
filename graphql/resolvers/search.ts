import { identity, pickBy } from "lodash";
import searcher from "../../services/searcher.js";
import { Course, Employee } from "../../types/types.js";
import { AggResults } from "../../types/searchTypes.js";

type SearchResultItem = Course | Employee;

interface SearchResultItemConnection {
  totalCount: number;
  pageInfo: {
    hasNextPage: boolean;
  };
  nodes: SearchResultItem[];
  filterOptions: AggResults;
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

      const hasNextPage = offset + first < results.resultCount;

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
