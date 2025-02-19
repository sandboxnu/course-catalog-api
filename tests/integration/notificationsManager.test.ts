import { suite, test, beforeEach, type TestContext } from "node:test";

import prisma from "$/services/prisma";
import notifs from "$/services/notificationsManager";

async function insertCourses(courseIds: string[]): Promise<void> {
  for (const course of courseIds) {
    await prisma.course.create({
      data: {
        id: course,
      },
    });
  }
}

async function insertSections(sectionIds: string[]): Promise<void> {
  for (const section of sectionIds) {
    await prisma.section.create({
      data: {
        id: section,
      },
    });
  }
}

test("upserting a user doesn't fail on duplicate", async () => {
  const phoneNumber = "this is a phone number string";
  await notifs.upsertUser(phoneNumber);
  await notifs.upsertUser(phoneNumber);
  await notifs.upsertUser(phoneNumber);
});

suite("user subscriptions", () => {
  const phoneNumber = "911";
  const sectionIds = ["a", "b", "c"];
  const courseIds = ["1"];

  beforeEach(async () => {
    await prisma.section.deleteMany({});
    await prisma.course.deleteMany({});
  });

  test("cannot insert subscriptions for nonexistent courses/sections", async (t: TestContext) => {
    await notifs.upsertUser(phoneNumber);
    t.assert.rejects(
      notifs.putUserSubscriptions(phoneNumber, sectionIds, courseIds),
    );
  });

  test("can insert new subscriptions", async (t: TestContext) => {
    await insertCourses(courseIds);
    await insertSections(sectionIds);

    await notifs.upsertUser(phoneNumber);
    await notifs.putUserSubscriptions(phoneNumber, sectionIds, courseIds);
    t.assert.deepStrictEqual(await notifs.getUserSubscriptions(phoneNumber), {
      phoneNumber,
      sectionIds: [],
      courseIds: [],
    });
  });

  test("gets no subscriptions for a user that doesn't exist", async (t: TestContext) => {
    t.assert.deepStrictEqual(await notifs.getUserSubscriptions(phoneNumber), {
      phoneNumber,
      courseIds: [],
      sectionIds: [],
    });
  });

  test("duplicate users and subscriptions aren't counted twice", async (t: TestContext) => {
    await insertCourses(courseIds);
    await insertSections(sectionIds);

    await notifs.upsertUser(phoneNumber);
    await notifs.putUserSubscriptions(phoneNumber, sectionIds, courseIds);
    await notifs.upsertUser(phoneNumber);
    await notifs.upsertUser(phoneNumber);
    await notifs.putUserSubscriptions(
      phoneNumber,
      sectionIds.slice(0, 1),
      courseIds,
    );

    t.assert.deepStrictEqual(await notifs.getUserSubscriptions(phoneNumber), {
      phoneNumber,
      sectionIds: [],
      courseIds: [],
    });
  });

  test("subscriptions can be deleted", async (t: TestContext) => {
    await insertCourses(courseIds);
    await insertSections(sectionIds);

    await notifs.upsertUser(phoneNumber);
    await notifs.putUserSubscriptions(phoneNumber, sectionIds, courseIds);
    await notifs.deleteUserSubscriptions(phoneNumber, sectionIds, []);
    t.assert.deepStrictEqual(await notifs.getUserSubscriptions(phoneNumber), {
      phoneNumber,
      sectionIds: [],
      courseIds: [],
    });

    await notifs.deleteAllUserSubscriptions(phoneNumber);
    t.assert.deepStrictEqual(await notifs.getUserSubscriptions(phoneNumber), {
      phoneNumber,
      sectionIds: [],
      courseIds: [],
    });

    await notifs.deleteAllUserSubscriptions(phoneNumber);
    t.assert.deepStrictEqual(await notifs.getUserSubscriptions(phoneNumber), {
      phoneNumber,
      sectionIds: [],
      courseIds: [],
    });
  });
});
