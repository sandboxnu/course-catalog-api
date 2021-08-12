import macros from "../utils/macros";
import prisma from "./prisma";

export interface UserInfo {
  phoneNumber: string;
  courseIds: string[];
  sectionIds: string[];
}

class NotificationsManager {
  async upsertUser(phoneNumber: string): Promise<void> {
    await prisma.user.upsert({
      create: { phoneNumber },
      update: {},
      where: { phoneNumber },
    });
    return;
  }

  async getUserSubscriptions(phoneNumber: string): Promise<UserInfo> {
    const userId = (await prisma.user.findFirst({ where: { phoneNumber } })).id;
    const followedSections = await prisma.followedSection.findMany({
      where: { userId },
    });
    const followedCourses = await prisma.followedCourse.findMany({
      where: { userId },
    });

    return {
      phoneNumber,
      sectionIds: followedSections.map((s) => s.sectionHash),
      courseIds: followedCourses.map((c) => c.courseHash),
    };
  }

  async putUserSubscriptions(
    phoneNumber: any,
    sectionIds: any,
    courseIds: any
  ): Promise<void> {
    const userId = (await prisma.user.findFirst({ where: { phoneNumber } })).id;
    const sectionTuples = sectionIds.map((s: string) => ({
      userId,
      sectionHash: s,
    }));
    const courseTuples = courseIds.map((c: string) => ({
      userId,
      courseHash: c,
    }));

    const sectionInserts = prisma.followedSection.createMany({
      data: sectionTuples,
      skipDuplicates: true,
    });
    const courseInserts = prisma.followedCourse.createMany({
      data: courseTuples,
      skipDuplicates: true,
    });

    await Promise.all([sectionInserts, courseInserts]);
    return;
  }

  async deleteUserSubscriptions(
    phoneNumber: any,
    sectionIds: any,
    courseIds: any
  ): Promise<void> {
    const userId = (await prisma.user.findFirst({ where: { phoneNumber } })).id;
    const sectionTuples = sectionIds.map((s: string) => ({
      userId,
      sectionHash: s,
    }));
    const courseTuples = courseIds.map((c: string) => ({
      userId,
      courseHash: c,
    }));

    const promises = [];
    for (const s of sectionTuples) {
      promises.push(
        prisma.followedSection.deleteMany({
          where: {
            userId: s.userId,
            sectionHash: s.sectionHash,
          },
        })
      );
    }
    for (const c of courseTuples) {
      promises.push(
        prisma.followedCourse.deleteMany({
          where: {
            userId: c.userId,
            courseHash: c.courseHash,
          },
        })
      );
    }

    await Promise.all(promises);
    return;
  }
}

const instance = new NotificationsManager();
export default instance;
