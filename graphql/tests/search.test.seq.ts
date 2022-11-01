import { gql } from "apollo-server";
import { mocked } from "jest-mock";
import searcher from "../../services/searcher";
import server from "../index";
import { Course, Requisite, Section } from "../../types/types";
import { DocumentNode } from "graphql";
import { GraphQLResponse } from "apollo-server-core";

jest.mock("../../services/searcher");

const query = async (queryBody: {
  query: string | DocumentNode;
}): Promise<GraphQLResponse> => {
  return server.executeOperation(queryBody);
};

const EMPTY_REQ: Requisite = {
  type: "or",
  values: [],
};

const FUNDIES: Course = {
  classId: "2500",
  name: "Fundamentals of Computer Science 1",
  termId: "202030",
  subject: "CS",
  host: "neu.edu",
  classAttributes: [],
  prettyUrl: "pretty",
  desc: "a class",
  url: "url",
  lastUpdateTime: 20,
  maxCredits: 4,
  minCredits: 0,
  coreqs: EMPTY_REQ,
  prereqs: EMPTY_REQ,
  feeAmount: 0,
  feeDescription: "None",
};

const SECTION: Section = {
  host: "neu.edu",
  crn: "1234",
  classId: "2500",
  classType: "lecture",
  termId: "202030",
  subject: "CS",
  seatsCapacity: 1,
  seatsRemaining: 1,
  lastUpdateTime: 20,
  waitCapacity: 0,
  waitRemaining: 0,

  campus: "Boston",
  honors: false,
  url: "url",
  profs: [],
  meetings: [],
};

describe("search resolver", () => {
  beforeEach(() => {
    mocked(searcher).search.mockClear();
  });

  it("searches for blank in term gets results", async () => {
    mocked(searcher).search.mockResolvedValue({
      aggregations: {
        nupath: [{ value: "Writing Intensive", count: 10 }],
        classType: [{ value: "Lecture", count: 10 }],
      },
      resultCount: 10,
      searchContent: [
        {
          type: "class",
          class: FUNDIES,
          sections: [SECTION],
        },
      ],
      took: { total: 1, es: 1, hydrate: 0 },
    });
    const res = await query({
      query: gql`
        query search {
          search(termId: "202030") {
            totalCount
            pageInfo {
              hasNextPage
            }
            nodes {
              __typename
              ... on Employee {
                name
              }
              ... on ClassOccurrence {
                name
                classAttributes
                url
                lastUpdateTime
                desc
                prereqsFor
                optPrereqsFor
                sections {
                  profs
                  crn
                }
              }
            }
            filterOptions {
              nupath {
                value
                count
              }
              subject {
                value
                count
              }
              classType {
                value
                count
              }
              campus {
                value
                count
              }
            }
          }
        }
      `,
    });
    expect(mocked(searcher).search.mock.calls[0]).toEqual([
      "",
      "202030",
      0,
      10,
      {},
    ]);
    expect(res).toMatchSnapshot({});
  });

  it("searches with filter works", async () => {
    mocked(searcher).search.mockResolvedValue({
      aggregations: {
        nupath: [{ value: "Writing Intensive", count: 10 }],
        classType: [{ value: "Lecture", count: 10 }],
      },
      resultCount: 0,
      searchContent: [],
      took: { total: 1, es: 1, hydrate: 0 },
    });
    await query({
      query: gql`
        query search {
          search(
            termId: "202030"
            query: "hey"
            subject: ["CS"]
            nupath: ["bruh"]
            classIdRange: { min: 1000, max: 2500 }
          ) {
            totalCount
          }
        }
      `,
    });
    expect(mocked(searcher).search.mock.calls[0]).toEqual([
      "hey",
      "202030",
      0,
      10,
      {
        subject: ["CS"],
        nupath: ["bruh"],
        classIdRange: { min: 1000, max: 2500 },
      },
    ]);
  });

  it("shows hasnextpage false when no more", async () => {
    mocked(searcher).search.mockResolvedValue({
      aggregations: {},
      resultCount: 1,
      searchContent: [
        {
          type: "class",
          class: FUNDIES,
          sections: [SECTION],
        },
      ],
      took: { total: 1, es: 1, hydrate: 0 },
    });
    const res = await query({
      query: gql`
        query search {
          search(termId: "202030") {
            totalCount
            pageInfo {
              hasNextPage
            }
          }
        }
      `,
    });
    expect(mocked(searcher).search.mock.calls[0]).toEqual([
      "",
      "202030",
      0,
      10,
      {},
    ]);
    expect(res.data.search).toEqual({
      totalCount: 1,
      pageInfo: { hasNextPage: false },
    });
  });
});
