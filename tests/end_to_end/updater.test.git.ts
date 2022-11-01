import { gql } from "apollo-server";
import server from "../../graphql/index";
import { DocumentNode } from "graphql";
import { GraphQLResponse } from "apollo-server-core";

async function query(q: DocumentNode): Promise<GraphQLResponse> {
  return await server.executeOperation({ query: q });
}

describe("Searching for courses", () => {
  //https://trello.com/c/fs503gwU/241-process-for-deleting-non-existent-sections-courses
  // In our setup, one instance of "202240/CS/2501" had its `last_update_time` set to the 20th century
  // As such - it's outdated, and the updater should have removed it
  test("outdated courses are removed by the updater", async () => {
    const res = await query(gql`
      query search {
        search(termId: "202240", query: "CS2501") {
          nodes {
            ... on ClassOccurrence {
              sections {
                termId
                crn
              }
            }
          }
        }
      }
    `);

    const crns = res.data?.search.nodes[0].sections.map((s) => s.crn);
    expect(crns.includes("123456789")).toBeTruthy();
    expect(crns.includes("987654321")).toBeFalsy();
  });
});
