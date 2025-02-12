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

export interface SearchArgs {
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
          honors: args.honors, // BUG: This is not return honors courses if the toggle is off!
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

      // Base query conditions
      const baseWhereConditions = {
        termId: args.termId,
        ...(args.classIdRange?.min && {
          classId: { gte: args.classIdRange.min },
        }),
        ...(args.classIdRange?.max && {
          classId: { lte: args.classIdRange.max },
        }),
      };

      // Parallel queries for better performance
      const [
        nupathCounts,
        subjectCounts,
        campusCounts,
        classTypeCounts,
        honorsCounts,
      ] = await Promise.all([
        // Nupath counts
        prisma.course
          .groupBy({
            by: ["nupath"],
            where: baseWhereConditions,
            _count: true,
          })
          .then((results) =>
            results.flatMap((r) =>
              r.nupath.map((np) => ({
                value: np,
                count: r._count,
                description: null,
              })),
            ),
          ),

        // Subject counts with descriptions
        prisma.$transaction(async (tx) => {
          const subjectGroups = await prisma.course.groupBy({
            by: ["subject"],
            where: baseWhereConditions,
            _count: true,
          });

          const subjects = await prisma.subject.findMany();
          const subjectDescMap = new Map(
            subjects.map((s) => [s.abbreviation, s.description]),
          );

          return subjectGroups.map((sg) => ({
            value: sg.subject || "",
            count: sg._count,
            description: subjectDescMap.get(sg.subject || "") || null,
          }));
        }),

        // Campus counts through sections
        prisma.section
          .groupBy({
            by: ["campus"],
            where: {
              course: { ...baseWhereConditions },
              ...(args.campus && { campus: { in: args.campus } }),
            },
            _count: true,
          })
          .then((results) =>
            results.map((r) => ({
              value: r.campus || "",
              count: r._count,
              description: null,
            })),
          ),

        // Campus counts through sections
        prisma.section
          .groupBy({
            by: ["classType"],
            where: {
              course: { ...baseWhereConditions },
              ...(args.classType && { campus: { in: args.classType } }),
            },
            _count: true,
          })
          .then((results) =>
            results.map((r) => ({
              value: r.classType || "",
              count: r._count,
              description: null,
            })),
          ),

        // Honors counts through sections
        prisma.section
          .groupBy({
            by: ["honors"],
            where: {
              course: { ...baseWhereConditions },
              ...(args.honors !== null && { honors: args.honors }),
            },
            _count: true,
          })
          .then((results) =>
            results.map((r) => ({
              value: r.honors ? "1" : "0",
              count: r._count,
              description: null,
            })),
          ),
      ]);

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
      console.log("Aggregations: ", endp - mappingp);
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
        filterOptions: {
          nupath: nupathCounts,
          subject: subjectCounts.filter((s) => s.value !== ""),
          campus: campusCounts.filter((c) => c.value !== ""),
          classType: classTypeCounts.filter((c) => c.value !== ""),
          honors: honorsCounts,
        } as AggResults,
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
