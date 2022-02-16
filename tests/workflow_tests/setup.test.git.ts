import { gql } from "apollo-server";
import prisma from "../../services/prisma";
import server from "../../graphql/index";
import { DocumentNode } from "graphql";
import { GraphQLResponse } from "apollo-server-core";

async function query(q: DocumentNode): Promise<GraphQLResponse> {
  return await server.executeOperation({ query: q });
}

// async function deepEqual(key: string): Promise<unknown[]> {

// }

describe("TermID setup", () => {
  test("term IDs are in the database", async () => {
    expect(await prisma.termInfo.count()).toBe(3);
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
    expect(res.data?.termInfos.length).toBe(3);
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

    console.log(dbTermInfos);
    console.log(gqlTermInfos);
    expect(dbTermInfos).toEqual(gqlTermInfos);
  });
});

describe("Course and section setup", () => {
  test("courses/sections are in the database", async () => {
    console.log(await prisma.course.count());
    console.log(await prisma.section.count());
    // 824 - summer 1
    // 1658 - summer full
    // 516 - summer 2
    // 2998
    expect(await prisma.course.count()).toBe(1307);
  });
});

// Check that there are courses in the cache
// Check that the number of courses is consistent - Banner, maybe?
// Check
