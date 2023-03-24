import { gql } from "apollo-server";
import prisma from "../../services/prisma";
import server from "../../graphql/index";
import { DocumentNode } from "graphql";
import { GraphQLResponse } from "apollo-server-core";

const NUM_TERMIDS = 3;
const NUMS_COURSES = {
  "202240": 646,
  "202250": 519,
  "202260": 493,
};
const NUMS_SECTIONS = {
  "202240": 840,
  "202250": 1634,
  "202260": 515,
};
const NUM_SECTIONS = Object.values(NUMS_SECTIONS).reduce((a, b) => a + b, 0);
const NUM_COURSES = Object.values(NUMS_COURSES).reduce((a, b) => a + b, 0);

/**
 * As part of this test suite, we run the updater, which fetches live data from Banner.
 * As a result, these counts will become innaccurate. If these counts ever deviate beyond these tolerances,
 * maybe it's time we start using a new semester(s) for these tests.
 */
const COURSE_COUNT_TOLERANCE = 20;
const SECTION_COUNT_TOLERANCE = 100;

async function query(q: DocumentNode): Promise<GraphQLResponse> {
  return await server.executeOperation({ query: q });
}

describe("TermID setup", () => {
  test("term IDs are in the database", async () => {
    expect(await prisma.termInfo.count()).toBe(NUM_TERMIDS);
  });

  test("termIDs are accessible through GraphQL", async () => {
    const res = await query(gql`
      query {
        termInfos(subCollege: "NEU") {
          text
          termId
          subCollege
        }
      }
    `);
    expect(res.data?.termInfos.length).toBe(NUM_TERMIDS);
  });

  test("The termIDs in the database match those in GraphQL", async () => {
    const res = await query(gql`
      query {
        termInfos(subCollege: "NEU") {
          text
          termId
          subCollege
        }
      }
    `);
    const gqlTermInfos = res.data?.termInfos.map((t) => t.termId).sort();

    const dbTermInfos = (
      await prisma.termInfo.findMany({
        select: {
          termId: true,
          subCollege: true,
          text: true,
        },
      })
    )
      .map((t) => t.termId)
      .sort();

    expect(dbTermInfos).toEqual(gqlTermInfos);
  });
});

describe("Course and section setup", () => {
  test("courses/sections are in the database", async () => {
    for (const [termId, expected] of Object.entries(NUMS_COURSES)) {
      const actual = await prisma.course.count({
        where: {
          termId: termId,
        },
      });
      expect(actual).toBeGreaterThan(expected - COURSE_COUNT_TOLERANCE);
      expect(actual).toBeLessThan(expected + COURSE_COUNT_TOLERANCE);
    }

    const actualCourses = await prisma.course.count();
    expect(actualCourses).toBeGreaterThan(NUM_COURSES - COURSE_COUNT_TOLERANCE);
    expect(actualCourses).toBeLessThan(NUM_COURSES + COURSE_COUNT_TOLERANCE);

    for (const [termId, expected] of Object.entries(NUMS_SECTIONS)) {
      const actual = await prisma.section.count({
        where: {
          course: {
            termId: termId,
          },
        },
      });
      expect(actual).toBeGreaterThan(expected - SECTION_COUNT_TOLERANCE);
      expect(actual).toBeLessThan(expected + SECTION_COUNT_TOLERANCE);
    }

    const actualSecs = await prisma.section.count();
    expect(actualSecs).toBeGreaterThan(NUM_SECTIONS - SECTION_COUNT_TOLERANCE);
    expect(actualSecs).toBeLessThan(NUM_SECTIONS + SECTION_COUNT_TOLERANCE);
  });

  test("Courses/sections are in GraphQL", async () => {
    for (const termId of Object.keys(NUMS_COURSES)) {
      const res = await query(gql`
        query {
          search(termId: "${termId}", query: "") {
            totalCount
          }
        }
      `);
      // It won't exactly match the number we have, but at least make sure we have SOMETHING
      expect(res.data?.search.totalCount).toBeGreaterThan(0);
    }
  });
});
