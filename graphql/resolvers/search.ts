import { identity, pickBy } from "lodash";
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
  isCurrentTerm: boolean;
}
function determineIfCurrentTerm(termId: number): boolean {
  const termIdStringify: String = termId.toString();
  const termIdYear: Number = +termIdStringify.substring(0, 4);

  const date = new Date();
  const year = date.getFullYear();

  if (termIdYear < year) {
    return false;
  }

  return false;
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
      const isCurrentTerm: boolean = determineIfCurrentTerm(args.termId);
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
