import { identity, pickBy } from "lodash";
import searcher from "../../services/searcher";
import { BackendMeeting, Course, Employee, Requisite } from "../../types/types";
import { AggResults } from "../../types/searchTypes";
import prisma from "../../services/prisma";
import { searchCourses } from "@prisma/client/sql";
import {
  Course as PrismaCourse,
  Section as PrismaSection,
} from "@prisma/client";

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
      args: SearchArgs,
    ): Promise<SearchResultItemConnection> => {
      const { offset = 0, first = 10 } = args;
      const starte = performance.now();
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
          identity,
        ),
      );

      const ende = performance.now();

      const startp = performance.now();
      const course_matches = await prisma.$queryRawTyped(
        searchCourses(
          args.query || "",
          args.termId,
          offset,
          offset + first,
          args.subject || [],
          args.nupath || [],
          args.classIdRange?.min || -1,
          args.classIdRange?.max || -1,
          args.campus || [],
          args.honors || false,
          args.classType || [],
        ),
      );

      const hasNextPage = offset + first < course_matches.length;

      const midp = performance.now();

      const course_ids = course_matches.slice(0, 10).map((c) => c.id);
      const rawCourses: PrismaCourse[] = await prisma.course.findMany({
        where: {
          id: {
            in: course_ids,
          },
        },
      });

      const coursesp = performance.now();

      const rawSections: PrismaSection[] = await prisma.section.findMany({
        where: {
          classHash: {
            in: course_ids,
          },
          campus: {
            in: args.campus,
          },
          honors: args.honors,
        },
      });

      const sectionsp = performance.now();

      // Sort the courses back to the relevancy order
      rawCourses.sort(
        (a, b) => course_ids.indexOf(a.id) - course_ids.indexOf(b.id),
      );

      const sortingp = performance.now();

      const results_p: Course[] = rawCourses.map((c) => {
        return {
          ...c,
          desc: c.description,
          lastUpdateTime: c.lastUpdateTime.getTime(),
          coreqs: c.coreqs as Requisite,
          prereqs: c.prereqs as Requisite,
          sections: rawSections
            .filter((s) => s.classHash == c.id)
            .map((s) => ({
              ...s,
              lastUpdateTime: s.lastUpdateTime.getTime(),
              classId: c.id,
              host: c.host,
              subject: c.subject,
              termId: c.termId,
              meetings: s.meetings as BackendMeeting[],
            })),
        };
      });

      const mappingp = performance.now();

      results_p.filter((r) => r.sections.length > 0);

      const endp = performance.now();

      console.log("===== Elastic Data ======");
      console.log("Duration: ", ende - starte);
      // console.log(
      //   results.searchContent
      //     .filter((s) => s.type == "class")
      //     .slice(0, 10)
      //     .map((c) => c?.class.name),
      // );
      console.log("===== Postgres Data =====");
      console.log("Duration: ", endp - startp);
      console.log("Searching: ", midp - startp);
      // console.log("Getting Courses: ", coursesp - midp);
      // console.log("Getting Sections: ", sectionsp - coursesp);
      // console.log("Sorting: ", sortingp - sectionsp);
      // console.log("Mapping: ", mappingp - sortingp);
      // console.log(results_p.slice(0, 10).map((c) => c.name));

      return {
        totalCount: course_matches.length,
        nodes: results_p,
        pageInfo: {
          hasNextPage,
        },
        filterOptions: results.aggregations,
      };

      // return {
      //   totalCount: results.resultCount,
      //   nodes: results.searchContent.map((r) =>
      //     r.type === "employee"
      //       ? r.employee
      //       : { ...r.class, sections: r.sections },
      //   ),
      //   pageInfo: {
      //     hasNextPage,
      //   },
      //   filterOptions: results.aggregations,
      // };
    },
  },

  SearchResultItem: {
    __resolveType(obj: SearchResultItem) {
      return "firstName" in obj ? "Employee" : "ClassOccurrence";
    },
  },
};

export default resolvers;
