import { gql } from "apollo-server";
import prisma from "../../services/prisma";
import server from "../../graphql/index";
import { DocumentNode } from "graphql";
import { GraphQLResponse } from "apollo-server-core";

const query = async (q: DocumentNode): Promise<GraphQLResponse> =>
  await server.executeOperation({ query: q });

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
    const rawGqlTermInfos = res.data?.termInfos;
    const gqlTermInfos = rawGqlTermInfos
      .map((t) => {
        return { ...t };
      })
      .sort((t) => Number.parseInt(t.termId));

    const dbTermInfos = (
      await prisma.termInfo.findMany({
        select: {
          termId: true,
          subCollege: true,
          text: true,
        },
      })
    ).sort((t) => Number.parseInt(t.termId));

    console.log(dbTermInfos.sort());
    console.log(gqlTermInfos.sort());
    expect(dbTermInfos).toEqual(gqlTermInfos);
  });
});

describe("Course and section setup", () => {
  test("courses/sections are in the database", async () => {
    console.log(await prisma.course.count());
    console.log(await prisma.section.count());
    expect(await prisma.course.count()).toBe(3);
  });
});

// Check that there are courses in the cache
// Check that the number of courses is consistent - Banner, maybe?
// Check
