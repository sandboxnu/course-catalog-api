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
      where: {
        userId,
        deleted_at: null,
        section: {
          course: {
            termId: {
              in: (
                await prisma.termInfo.findMany({
                  where: { active: true },
                  select: { termId: true },
                })
              ).map((term) => term.termId),
            },
          },
        },
      },
    });
    const followedCourses = await prisma.followedCourse.findMany({
      where: {
        userId,
        deleted_at: null,
        course: {
          termId: {
            in: (
              await prisma.termInfo.findMany({
                where: { active: true },
                select: { termId: true },
              })
            ).map((term) => term.termId),
          },
        },
      },
    });

    return {
      phoneNumber,
      sectionIds: followedSections.map((s) => s.sectionHash),
      courseIds: followedCourses.map((c) => c.courseHash),
    };
  }

  async putUserSubscriptions(
    phoneNumber: string,
    sectionIds: string[],
    courseIds: string[],
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
    phoneNumber: string,
    sectionIds: string[],
    courseIds: string[],
  ): Promise<void> {
    const userId = (await prisma.user.findFirst({ where: { phoneNumber } })).id;

    const promises = [];

    promises.push(
      prisma.followedSection.updateMany({
        where: {
          userId: userId,
          sectionHash: { in: sectionIds },
        },
        data: {
          deleted_at: new Date(),
        },
      }),
    );

    promises.push(
      prisma.followedCourse.updateMany({
        where: {
          userId: userId,
          courseHash: { in: courseIds },
        },
        data: {
          deleted_at: new Date(),
        },
      }),
    );

    await Promise.all(promises);
    return;
  }

  async deleteAllUserSubscriptions(phoneNumber: string): Promise<void> {
    const userId = (await prisma.user.findFirst({ where: { phoneNumber } })).id;
    await prisma.followedSection.updateMany({
      where: { userId },
      data: {
        deleted_at: new Date(),
      },
    });
    await prisma.followedCourse.updateMany({
      where: { userId, deleted_at: null },
      data: {
        deleted_at: new Date(),
      },
    });
    macros.log(`deleted all user subscriptions for ${phoneNumber}`);
    return;
  }
}

const instance = new NotificationsManager();
export default instance;
