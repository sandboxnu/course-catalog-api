import { gql } from "apollo-server";
import server from "../../graphql/index";
import { DocumentNode } from "graphql";
import { GraphQLResponse } from "apollo-server-core";

async function query(q: DocumentNode): Promise<GraphQLResponse> {
  return await server.executeOperation({ query: q });
}

describe("Searching for courses", () => {
  // https://trello.com/c/AFcdt4tt/106-display-one-search-result-with-a-course-code
  test("searching for a single course returns it as a result", async () => {
    const queries = ["CS2500", "cs2500", "cs 2500", "CS 2500"];
    for (const q of queries) {
      const res = await query(gql`
            query {
                search(termId: "202240", query: "${q}") {
                  nodes {
                    ... on ClassOccurrence {
                      name
                    }
                  }
                }
              }
          `);

      const result = res.data?.search.nodes || [];
      const names = result.map((node) => node.name);

      expect(names.includes("Fundamentals of Computer Science 1")).toBeTruthy();
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

    const name = res.data?.search.nodes[0].name;
    expect(name).toMatch(/Fundamentals of Computer Science.*/);
  });
});

describe("Searching for professors", () => {
  test("searching by professor name", async () => {
    const res = await query(gql`
      query {
        search(termId: "202240", query: "Felleisen Matthias") {
          nodes {
            ... on Employee {
              name
              firstName
              lastName
              email
            }
          }
        }
      }
    `);

    const obj = res.data?.search.nodes[0];
    expect(obj.firstName).toBe("Matthias");
    expect(obj.lastName).toBe("Felleisen");
    expect(obj.name).toBe("Matthias Felleisen");

    const res2 = await query(gql`
      query {
        search(termId: "202240", query: "Jeff Burds") {
          nodes {
            ... on Employee {
              name
              firstName
              lastName
              email
            }
          }
        }
      }
    `);

    const obj2 = res2.data?.search.nodes[0];
    expect(obj2.name).toBe("Jeff Burds");
  });
});
