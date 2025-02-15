import searcher from "../../services/searcher";
import { Course, Employee } from "../../types/types";
import { AggResults } from "../../types/searchTypes";

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
      parent: any,
      args: SearchArgs,
    ): Promise<SearchResultItemConnection> => {
      const { offset = 0, first = 10 } = args;

      const results = await searcher.search(
        args.query || "",
        args.termId,
        offset,
        offset + first,
        {
          // Includes on the filters that actually have values set (are not undefined)
          ...(args.subject != null && { subject: args.subject }),
          ...(args.nupath != null && { subject: args.nupath }),
          ...(args.campus != null && { subject: args.campus }),
          ...(args.classType != null && { subject: args.classType }),
          ...(args.classIdRange != null && { subject: args.classIdRange }),
          ...(args.honors != null && { subject: args.honors }),
        },
      );

      const hasNextPage = offset + first < results.resultCount;

      return {
        totalCount: results.resultCount,
        nodes: results.searchContent.map((r) =>
          r.type === "employee"
            ? r.employee
            : { ...r.class, sections: r.sections },
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
