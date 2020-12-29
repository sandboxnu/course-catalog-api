import { identity, pickBy } from 'lodash';
import searcher from '../../searcher';
import { Course, Employee } from '../../types';

type SearchResultItem = Course | Employee;

interface SearchResultItemConnection {
  totalCount: number;
  pageInfo: {
    hasNextPage: boolean;
  };
  nodes: SearchResultItem[];
}

interface SearchArgs {
  termId: number;
  query?: string;
  subject?: string[];
  nupath?: string[];
  campus?: string[];
  classType?: string[];
  classIdRange?: { min: number; max: number };

  offset: number;
  first: number;
}
const resolvers = {
  Query: {
    search: async (parent, args: SearchArgs): Promise<SearchResultItemConnection> => {
      const { offset = 0, first = 10 } = args;
      const results = await searcher.search(
        args.query || '',
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
          },
          identity,
        ),
      );

      const hasNextPage = offset + first < results.resultCount;

      return {
        totalCount: results.resultCount,
        nodes: results.searchContent.map((r) => (r.type === 'employee'
          ? r.employee
          : { ...r.class, sections: r.sections })),
        pageInfo: {
          hasNextPage,
        },
      };
    },
  },

  SearchResultItem: {
    // eslint-disable-next-line no-underscore-dangle
    __resolveType(obj: SearchResultItem) {
      return 'firstName' in obj ? 'Employee' : 'ClassOccurrence';
    },
  },
};

export default resolvers;
