import { gql } from "apollo-server";
import prisma from "../../services/prisma";
import server from "../../graphql/index";
import { DocumentNode } from "graphql";
import { GraphQLResponse } from "apollo-server-core";
import elastic from "../../utils/elastic";

const NUM_TERMIDS = 3;
const NUM_COURSES = 1658;
const NUMS_SECTIONS = {
  "202240": 839,
  "202250": 1634,
  "202260": 515,
};
const TOTAL_NUM_SECTIONS = Object.values(NUMS_SECTIONS).reduce(
  (a, b) => a + b,
  0
);

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
    expect(await prisma.course.count()).toBe(NUM_COURSES);

    for (const [termId, count] of Object.entries(NUMS_SECTIONS)) {
      expect(
        await prisma.section.count({
          where: {
            course: {
              termId: termId,
            },
          },
        })
      ).toBe(count);
    }

    expect(await prisma.section.count()).toBe(TOTAL_NUM_SECTIONS);
  });

  test("Courses/sections are in GraphQL", async () => {
    for (const [termId, count] of Object.entries(NUMS_SECTIONS)) {
      const res = await query(gql`
        query {
          search(termId: "${termId}", query: "") {
            totalCount
          }
        }
      `);
      expect(res.data?.search.totalCount).toBe(count);
    }
  });
});

// Check that there are courses in the cache
// Check that the number of courses is consistent - Banner, maybe?
// Check
