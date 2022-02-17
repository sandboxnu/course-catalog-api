import { gql } from "apollo-server";
import prisma from "../../services/prisma";
import server from "../../graphql/index";
import { DocumentNode } from "graphql";
import { GraphQLResponse } from "apollo-server-core";
import elastic from "../../utils/elastic";

async function query(q: DocumentNode): Promise<GraphQLResponse> {
  return await server.executeOperation({ query: q });
}

describe("Searching for courses", () => {
  // https://trello.com/c/AFcdt4tt/106-display-one-search-result-with-a-course-code
  test("searching for a single course only returns one result", async () => {
    const queries = ["CS2500", "cs2500", "cs 2500", "CS 2500"];
    for (const q of queries) {
      const res = await query(gql`
            query {
                search(termId: "202240", query: "${q}") {
                  totalCount
                }
              }
          `);

      expect(res.data?.search.totalCount).toBe(1);
    }
  });

  // https://trello.com/c/hjjm4QiT/184-common-keywords-no-longer-return-classes
  test("Course mappings work", async () => {
    const res = await query(gql`
      query {
        search(termId: "202240", query: "fundies") {
          nodes {
            ... on ClassOccurrence {
              name
              subject
              classId
            }
          }
        }
      }
    `);

    const name = res.data.search.nodes[0].name;
    expect(name).toMatch(/Fundamentals of Computer Science.*/);
  });
});
