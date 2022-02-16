import { gql } from "apollo-server";
import prisma from "../../services/prisma";
import server from "../../graphql/index";
import { DocumentNode } from "graphql";

const query = async (q: DocumentNode) =>
  await server.executeOperation({ query: q });

describe("Ensure termIDs have been populated", () => {
  test("term IDs are in the database", async () => {
    const numTermIds = await prisma.subject.count();
    expect(numTermIds).toBe(3);
  });

  test("termIDs are accessible through GraphQL", async () => {
    console.log(
      await query(gql`
        query {
          termInfos(subCollege: "NEU") {
            text
            termId
            subCollege
          }
        }
      `)
    );
  });

  test.todo("The termIDs in the database match those in GraphQL");
  //   # psql -U postgres -d searchneu_dev -c 'SELECT * FROM term_ids'

  //   # - run: 'curl ''http://localhost:4000/'' -X POST -H ''content-type: application/json'' --data ''{"query": "{ termInfos(subCollege: \"NEU\") { text termId subCollege } }"}'''
});

// Check that there are courses in the cache
// Check that the number of courses is consistent - Banner, maybe?
// Check
