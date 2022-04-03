import { gql } from "apollo-server";
import server from "../../graphql/index";
import { DocumentNode } from "graphql";
import { GraphQLResponse } from "apollo-server-core";

async function query(q: DocumentNode): Promise<GraphQLResponse> {
  return await server.executeOperation({ query: q });
}

describe("Searching for courses", () => {
  //https://trello.com/c/fs503gwU/241-process-for-deleting-non-existent-sections-courses
  // In our setup, all instances of "202240/CS/2501" classes have had their `last_update_time` set to the 20th century
  // As such - they're outdated, and the updater should have removed them
  test("outdated courses are removed by the updater", async () => {
    const res = await query(gql`
      query {
        search(termId: "202240", query: "CS2501") {
          totalCount
        }
      }
    `);

    expect(res.data?.search.totalCount).toBe(0);
  });
});
