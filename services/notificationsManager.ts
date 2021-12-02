import prisma from "./prisma";
import { UserInfo } from "../types/notifTypes";
import macros from "../utils/macros";

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

    const promises = [];

    promises.push(
      prisma.followedSection.deleteMany({
        where: {
          userId: userId,
          sectionHash: { in: sectionIds },
        },
      })
    );

    promises.push(
      prisma.followedCourse.deleteMany({
        where: {
          userId: userId,
          courseHash: { in: courseIds },
        },
      })
    );

    await Promise.all(promises);
    return;
  }

  async deleteAllUserSubscriptions(phoneNumber: string): Promise<void> {
    const userId = (await prisma.user.findFirst({ where: { phoneNumber } })).id;
    await prisma.followedSection.deleteMany({
      where: { userId },
    });
    await prisma.followedCourse.deleteMany({
      where: { userId },
    });
    macros.log(`deleted all user subscriptions for ${phoneNumber}`);
    return;
  }
}

const instance = new NotificationsManager();
export default instance;
