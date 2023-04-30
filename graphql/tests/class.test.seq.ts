/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import { gql } from "apollo-server";
import { GraphQLResponse } from "apollo-server-core";
import { DocumentNode, GraphQLError } from "graphql";
import prisma from "../../services/prisma";
import server from "../index";

const query = async (queryBody: {
  query: string | DocumentNode;
}): Promise<GraphQLResponse> => {
  return server.executeOperation(queryBody);
};

beforeAll(async () => {
  await prisma.section.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.course.create({
    data: {
      id: "neu.edu/201930/CS/3500",
      host: "neu.edu",
      termId: "201930",
      subject: "CS",
      classId: "3500",
      name: "OOD",
      lastUpdateTime: new Date(),
    },
  });

  await prisma.course.create({
    data: {
      id: "neu.edu/201930/CS/2500",
      host: "neu.edu",
      termId: "201930",
      subject: "CS",
      classId: "2500",
      name: "Fundamentals of Computer Science 1",
      lastUpdateTime: new Date(),
    },
  });

  await prisma.course.create({
    data: {
      id: "neu.edu/201830/CS/2500",
      host: "neu.edu",
      termId: "201830",
      subject: "CS",
      classId: "2500",
      name: "Fundamentals of Computer Science 1",
      lastUpdateTime: new Date(),
    },
  });

  await prisma.section.create({
    data: {
      id: "neu.edu/201830/CS/2500/12345",
      seatsCapacity: 5,
      seatsRemaining: 2,
      campus: "Boston",
      honors: false,
      crn: "12345",
      meetings: {},
      classType: "Lecture",
    },
  });
});
describe("class query", () => {
  it("can query in bulk", async () => {
    const res = await query({
      query: gql`
        query class {
          bulkClasses(
            input: [
              { subject: "CS", classId: "3500" }
              { subject: "CS", classId: "2500" }
            ]
          ) {
            subject
            classId
            name
            latestOccurrence {
              termId
            }
          }
        }
      `,
    });
    expect(res).toMatchSnapshot();
  });

  it("gets all occurrences", async () => {
    const res = await query({
      query: gql`
        query class {
          class(subject: "CS", classId: "2500") {
            name
            allOccurrences {
              termId
            }
          }
        }
      `,
    });
    expect(res).toMatchSnapshot();
  });

  it("gets latest occurrence", async () => {
    const res = await query({
      query: gql`
        query class {
          class(subject: "CS", classId: "2500") {
            name
            latestOccurrence {
              termId
            }
          }
        }
      `,
    });
    expect(res).toMatchSnapshot();
  });

  it("gets specific occurrence", async () => {
    const res = await query({
      query: gql`
        query class {
          class(subject: "CS", classId: "2500") {
            name
            occurrence(termId: "201930") {
              termId
            }
          }
        }
      `,
    });
    expect(res).toMatchSnapshot();
  });

  it("gets the name of class from subject and classId", async () => {
    const res = await query({
      query: gql`
        query class {
          class(subject: "CS", classId: "2500") {
            name
          }
        }
      `,
    });
    expect(res).toMatchSnapshot();
  });
});

describe("returns errors for non-existant classes", () => {
  it("returns error for missing class", async () => {
    const res = await query({
      query: gql`
        query class {
          class(subject: "CS", classId: "2510") {
            name
          }
        }
      `,
    });

    expect(res?.errors?.length).toBe(1);
    expect(res?.errors?.[0]).toEqual(
      new GraphQLError(
        `We couldn't find any occurrences of a class with subject 'CS' and class ID '2510'`
      )
    );
  });

  it("does not throw errors for missing bulk classes", async () => {
    const res = await query({
      query: gql`
        query bulkClass {
          bulkClasses(
            input: [
              { subject: "CS", classId: "2510" }
              { subject: "CS", classId: "2511" }
            ]
          ) {
            name
          }
        }
      `,
    });

    expect(res?.errors).toBeUndefined();
    // This doesn't throw an error - it just omits any classes for which we have no data
    expect(res?.data).toEqual({
      bulkClasses: [],
    });
  });

  it("returns an error for allOccurrences", async () => {
    const res = await query({
      query: gql`
        query class {
          class(subject: "CS", classId: "2510") {
            allOccurrences {
              name
            }
          }
        }
      `,
    });

    expect(res?.errors?.length).toBe(1);
    expect(res?.errors?.[0]).toEqual(
      new GraphQLError(
        `We couldn't find any occurrences of a class with subject 'CS' and class ID '2510'`
      )
    );
  });

  it("returns an error for occurrence", async () => {
    const res = await query({
      query: gql`
        query class {
          class(subject: "CS", classId: "2500") {
            occurrence(termId: "202310") {
              name
            }
          }
        }
      `,
    });

    expect(res?.errors?.length).toBe(1);
    expect(res?.errors?.[0]).toEqual(
      new GraphQLError(
        "We couldn't find a course matching the term '202310', subject 'CS', and class ID '2500'"
      )
    );
  });

  it("returns an error for classByHash", async () => {
    const res = await query({
      query: gql`
        query class {
          classByHash(hash: "neu.edu/202310/CS/2500") {
            name
          }
        }
      `,
    });

    expect(res?.errors?.length).toBe(1);
    expect(res?.errors?.[0]).toEqual(
      new GraphQLError(
        "We couldn't find a course matching the hash 'neu.edu/202310/CS/2500'"
      )
    );
  });

  it("returns an error for sectionByHash", async () => {
    const res = await query({
      query: gql`
        query section {
          sectionByHash(hash: "neu.edu/201830/CS/2500/123456") {
            seatsRemaining
          }
        }
      `,
    });

    expect(res?.errors?.length).toBe(1);
    expect(res?.errors?.[0]).toEqual(
      new GraphQLError(
        "We couldn't find a section matching the hash 'neu.edu/201830/CS/2500/123456'"
      )
    );
  });
});

describe("classByHash query", () => {
  it("gets class from class hash", async () => {
    const res = await query({
      query: gql`
        query classByHash {
          classByHash(hash: "neu.edu/201830/CS/2500") {
            name
            subject
            classId
            termId
          }
        }
      `,
    });
    expect(res).toMatchSnapshot();
  });
});

describe("sectionByHash query", () => {
  it("gets section from section id", async () => {
    const res = await query({
      query: gql`
        query sectionByHash {
          sectionByHash(hash: "neu.edu/201830/CS/2500/12345") {
            termId
            subject
            classId
            classType
            crn
            seatsCapacity
            seatsRemaining
            campus
            honors
            meetings
          }
        }
      `,
    });
    expect(res).toMatchSnapshot();
  });
});
