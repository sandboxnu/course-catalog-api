import gql from "graphql-tag";
import prisma from "../../services/prisma";
import server from "../../graphql/index";
import { DocumentNode } from "graphql";
import { GraphQLResponse } from "@apollo/server";

const NUM_TERMIDS = 3;
const NUMS_COURSES = {
  "202240": 635,
  "202250": 502,
  "202260": 545,
};
const NUMS_SECTIONS = {
  "202240": 813 + 1, // There are 813 sections, but one additional section that we added during setup
  "202250": 1380,
  "202260": 650,
};
const NUM_SECTIONS = Object.values(NUMS_SECTIONS).reduce((a, b) => a + b, 0);
const NUM_COURSES = Object.values(NUMS_COURSES).reduce((a, b) => a + b, 0);

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

    if (res.body.kind !== "single") {
      fail("incorrect graphql response kind");
    }

    // @ts-ignore - added since singleResult is implicitly an unknown
    expect(res.body.singleResult.termInfos.length).toBe(NUM_TERMIDS);
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

    if (res.body.kind !== "single") {
      fail("incorrect graphql response kind");
    }

    // @ts-ignore - added since singleResult is implicitly an unknown
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
      expect(actual).toBe(expected);
    }

    expect(await prisma.course.count()).toBe(NUM_COURSES);

    for (const [termId, expected] of Object.entries(NUMS_SECTIONS)) {
      const actual = await prisma.section.count({
        where: {
          course: {
            termId: termId,
          },
        },
      });

      expect(actual).toBe(expected);
    }

    expect(await prisma.section.count()).toBe(NUM_SECTIONS);
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

      if (res.body.kind !== "single") {
        fail("incorrect graphql response kind");
      }

      // It won't exactly match the number we have, but at least make sure we have SOMETHING
      // @ts-ignore - added since singleResult is implicitly an unknown
      expect(res.data?.search.totalCount).toBeGreaterThan(0);
    }
  });
});
