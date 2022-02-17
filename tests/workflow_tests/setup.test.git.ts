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
    // 1658 - summer full
    // 516 - summer 2
    // 2988 total
    console.log(await prisma.course.count());
    // expect(await prisma.course.count()).toBe(NUM_COURSES);

    for (const [termId, count] of Object.entries(NUMS_SECTIONS)) {
      console.log(
        await prisma.section.count({
          where: {
            course: {
              termId: termId,
            },
          },
        })
      );
      // expect(
      //   await prisma.section.count({
      //     where: {
      //       course: {
      //         termId: termId,
      //       },
      //     },
      //   })
      // ).toBe(count);
    }

    expect(await prisma.section.count()).toBe(TOTAL_NUM_SECTIONS);
  });

  // test("Courses/sections are in GraphQL", async () => {
  //   const res = await query(gql`
  //     query {
  //       termInfos(subCollege: "NEU") {
  //         text
  //         termId
  //         subCollege
  //       }
  //     }
  //   `);
  //   const gqlTermInfos = res.data?.termInfos.map((t) => t.termId).sort();
  // })
});

// Check that there are courses in the cache
// Check that the number of courses is consistent - Banner, maybe?
// Check
