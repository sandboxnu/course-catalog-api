import prisma from "../../services/prisma";
import notifs from "../../services/notificationsManager";

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

it("upserting a user doesn't fail on duplicate", async () => {
  const phoneNumber = "this is a phone number string";
  await notifs.upsertUser(phoneNumber);
  await notifs.upsertUser(phoneNumber);
  await notifs.upsertUser(phoneNumber);
});

describe("user subscriptions", () => {
  const phoneNumber = "911";
  const sectionIds = ["a", "b", "c"];
  const courseIds = ["1"];

  beforeEach(async () => {
    await prisma.section.deleteMany({});
    await prisma.course.deleteMany({});
  });

  it("cannot insert subscriptions for nonexistent courses/sections", async () => {
    await notifs.upsertUser(phoneNumber);
    await expect(
      notifs.putUserSubscriptions(phoneNumber, sectionIds, courseIds),
    ).rejects.toThrow("Foreign key constraint violated");
  });

  it("can insert new subscriptions", async () => {
    await insertCourses(courseIds);
    await insertSections(sectionIds);

    await notifs.upsertUser(phoneNumber);
    await notifs.putUserSubscriptions(phoneNumber, sectionIds, courseIds);
    expect(await notifs.getUserSubscriptions(phoneNumber)).toEqual({
      phoneNumber,
      sectionIds: [],
      courseIds: [],
    });
  });

  it("gets no subscriptions for a user that doesn't exist", async () => {
    expect(await notifs.getUserSubscriptions(phoneNumber)).toEqual({
      phoneNumber,
      courseIds: [],
      sectionIds: [],
    });
  });

  it("duplicate users and subscriptions aren't counted twice", async () => {
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

    expect(await notifs.getUserSubscriptions(phoneNumber)).toEqual({
      phoneNumber,
      sectionIds: [],
      courseIds: [],
    });
  });

  it("subscriptions can be deleted", async () => {
    await insertCourses(courseIds);
    await insertSections(sectionIds);

    await notifs.upsertUser(phoneNumber);
    await notifs.putUserSubscriptions(phoneNumber, sectionIds, courseIds);
    await notifs.deleteUserSubscriptions(phoneNumber, sectionIds, []);
    expect(await notifs.getUserSubscriptions(phoneNumber)).toEqual({
      phoneNumber,
      sectionIds: [],
      courseIds: [],
    });

    await notifs.deleteAllUserSubscriptions(phoneNumber);
    expect(await notifs.getUserSubscriptions(phoneNumber)).toEqual({
      phoneNumber,
      sectionIds: [],
      courseIds: [],
    });

    await notifs.deleteAllUserSubscriptions(phoneNumber);
    expect(await notifs.getUserSubscriptions(phoneNumber)).toEqual({
      phoneNumber,
      sectionIds: [],
      courseIds: [],
    });
  });
});
