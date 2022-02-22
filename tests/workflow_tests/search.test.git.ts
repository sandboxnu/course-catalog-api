import { gql } from "apollo-server";
import server from "../../graphql/index";
import { DocumentNode } from "graphql";
import { GraphQLResponse } from "apollo-server-core";

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

// describe("Searching for professors", () => {
//   test("searching by professor name", async () => {
//     const res = await query(gql`
//       query {
//         search(termId: "202240", query: "jason hemann") {
//           nodes {
//             ... on Employee {
//               name
//               firstName
//               lastName
//               emails
//             }
//           }
//         }
//       }
//     `);

//     const obj = res.data.search.nodes[0];
//     console.log(JSON.stringify(obj));
//     // expect(obj.firstName).toBe("Jason");
//     // expect(obj.lastName).toBe("Hemann");

//     const res2 = await query(gql`
//       query {
//         search(termId: "202240", query: "") {
//           nodes {
//             ... on Employee {
//               name
//               firstName
//               lastName
//               emails
//             }
//           }
//         }
//       }
//     `);

//     console.log(res2.data.search.nodes);
//     console.log(JSON.stringify(res2.data.search.nodes));
//   });
// });
