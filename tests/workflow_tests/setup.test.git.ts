import { gql } from "apollo-server";
import prisma from "../../services/prisma";
import server from "../../graphql/index";
import { DocumentNode } from "graphql";

const query = async (q: DocumentNode) =>
  await server.executeOperation({ query: q });

describe("Ensure termIDs have been populated", () => {
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
    const gqlTermInfos = res.data?.termInfos;

    const dbTermInfos = prisma.termInfo.findMany({
      select: {
        termId: true,
        subCollege: true,
        text: true,
      },
    });

    console.log(dbTermInfos);
    console.log(gqlTermInfos);
  });
  //   # psql -U postgres -d searchneu_dev -c 'SELECT * FROM term_ids'

  //   # - run: 'curl ''http://localhost:4000/'' -X POST -H ''content-type: application/json'' --data ''{"query": "{ termInfos(subCollege: \"NEU\") { text termId subCollege } }"}'''
});

// Check that there are courses in the cache
// Check that the number of courses is consistent - Banner, maybe?
// Check
