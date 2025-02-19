/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import { suite, test, before, type TestContext } from "node:test";

import { gql } from "graphql-tag";
import { GraphQLResponse } from "@apollo/server";
import { DocumentNode, GraphQLError } from "graphql";
import prisma from "$/services/prisma";
import { server } from "$/router/gqlRouter";

const query = async (queryBody: {
  query: string | DocumentNode;
}): Promise<GraphQLResponse> => {
  return server.executeOperation(queryBody);
};

const insertDummyData = async () => {
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
};

suite("class query", () => {
  before(insertDummyData);
  test("can query in bulk", async (t) => {
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

    t.assert.snapshot(res);
  });

  test("gets all occurrences", async (t) => {
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
    t.assert.snapshot(res);
  });

  test("gets latest occurrence", async (t) => {
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
    t.assert.snapshot(res);
  });

  test("gets specific occurrence", async (t) => {
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
    t.assert.snapshot(res);
  });

  test("gets the name of class from subject and classId", async (t) => {
    const res = await query({
      query: gql`
        query class {
          class(subject: "CS", classId: "2500") {
            name
          }
        }
      `,
    });
    t.assert.snapshot(res);
  });
});

suite("returns errors for non-existant classes", () => {
  before(insertDummyData),
    test("returns error for missing class", async (t: TestContext) => {
      const res = await query({
        query: gql`
          query class {
            class(subject: "CS", classId: "2510") {
              name
            }
          }
        `,
      });

      t.assert.ok(res.body.kind === "single");
      t.assert.equal(res.body.singleResult.errors?.length, 1);
      t.assert.equal(
        res.body.singleResult.errors?.[0].extensions?.code,
        "COURSE_NOT_FOUND",
      );
    });

  test("does not throw errors for missing bulk classes", async (t: TestContext) => {
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

    t.assert.ok(res.body.kind === "single");
    t.assert.equal(res.body.singleResult.errors, undefined);
    t.assert.deepEqual(res.body.singleResult.data, {
      bulkClasses: [],
    });
  });

  test("returns an error for allOccurrences", async (t: TestContext) => {
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

    t.assert.ok(res.body.kind === "single");
    t.assert.equal(res.body.singleResult.errors?.length, 1);
    t.assert.equal(
      res.body.singleResult.errors?.[0].extensions?.code,
      "COURSE_NOT_FOUND",
    );
  });

  test("returns an error for occurrence", async (t: TestContext) => {
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

    t.assert.ok(res.body.kind === "single");
    t.assert.equal(res.body.singleResult.errors?.length, 1);
    t.assert.equal(
      res.body.singleResult.errors?.[0].extensions?.code,
      "COURSE_NOT_FOUND",
    );
  });

  test("returns an error for classByHash", async (t: TestContext) => {
    const res = await query({
      query: gql`
        query class {
          classByHash(hash: "neu.edu/202310/CS/2500") {
            name
          }
        }
      `,
    });

    t.assert.ok(res.body.kind === "single");
    t.assert.equal(res.body.singleResult.errors?.length, 1);
    t.assert.equal(
      res.body.singleResult.errors?.[0].extensions?.code,
      "COURSE_NOT_FOUND",
    );
  });

  test("returns an error for sectionByHash", async (t: TestContext) => {
    const res = await query({
      query: gql`
        query section {
          sectionByHash(hash: "neu.edu/201830/CS/2500/123456") {
            seatsRemaining
          }
        }
      `,
    });

    t.assert.ok(res.body.kind === "single");
    t.assert.equal(res.body.singleResult.errors?.length, 1);
    t.assert.equal(
      res.body.singleResult.errors?.[0].extensions?.code,
      "SECTION_NOT_FOUND",
    );
  });
});

suite("classByHash query", () => {
  test("gets class from class hash", async (t) => {
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

    t.assert.snapshot(res);
  });
});

suite("sectionByHash query", () => {
  test("gets section from section id", async (t) => {
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

    t.assert.snapshot(res);
  });
});
