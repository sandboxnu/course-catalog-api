/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import { User } from "@prisma/client";
import prisma from "./prisma";
import twilioNotifyer from "../twilio/notifs";
import macros from "../utils/macros";
import {
  CourseNotificationInfo,
  NotificationInfo,
  SectionNotificationInfo,
} from "../types/notifTypes";

function generateCourseMessage(course: CourseNotificationInfo): string {
  const classCode = `${course.subject} ${course.courseId}`;
  let message = "";
  if (course.numberOfSectionsAdded === 1) {
    message += `A section was added to ${classCode}!`;
  } else {
    message += `${course.numberOfSectionsAdded} sections were added to ${classCode}!`;
  }
  message += ` Check it out at https://searchneu.com/${course.campus}/${course.termId}/search/${course.subject}${course.courseId} !`;
  return message;
}

function generateSectionMessage(section: SectionNotificationInfo): string {
  if (section.seatsRemaining > 0) {
    return `A seat opened up in ${section.subject} ${section.courseId} (CRN: ${section.crn}). Check it out at https://searchneu.com/${section.campus}/${section.termId}/search/${section.subject}${section.courseId} !`;
  } else {
    return `A waitlist seat has opened up in ${section.subject} ${section.courseId} (CRN: ${section.crn}). Check it out at https://searchneu.com/${section.campus}/${section.termId}/search/${section.subject}${section.courseId} !`;
  }
}

export async function sendNotifications(
  notificationInfo: NotificationInfo,
  courseHashToUsers: Record<string, User[]>,
  sectionHashToUsers: Record<string, User[]>
): Promise<void> {
  if (
    notificationInfo.updatedCourses.length === 0 &&
    notificationInfo.updatedSections.length === 0
  ) {
    macros.log("no notifications to send!");
    return;
  } else {
    const courseNotifPromises: Promise<void>[] = notificationInfo.updatedCourses
      .map(async (course) => {
        const users = courseHashToUsers[course.courseHash] ?? [];

        await prisma.followedCourse.updateMany({
          where: {
            courseHash: course.courseHash,
            userId: { in: users.map((u) => u.id) },
          },
          data: {
            notifCount: { increment: 1 },
          },
        });

        return users.map(async (user) => {
          const courseMessage = generateCourseMessage(course);
          const currFollowedCourse = await prisma.followedCourse.findFirst({
            where: {
              courseHash: course.courseHash,
              userId: user.id,
            },
          });
          const notifyer =
            currFollowedCourse.notifCount < 3
              ? twilioNotifyer.sendNotificationText(
                  user.phoneNumber,
                  courseMessage
                )
              : twilioNotifyer.sendNotificationText(
                  user.phoneNumber,
                  `${courseMessage} This is your 3rd alert; you are now unsubscribed from this notification.`
                );
          return notifyer;
        });
      })
      .reduce((acc, val) => acc.concat(val), []);

    const sectionNotifPromises: Promise<void>[] =
      notificationInfo.updatedSections
        .map(async (section) => {
          const users = sectionHashToUsers[section.sectionHash] ?? [];

          //increment notifCount of this section's entries in followedSection
          await prisma.followedSection.updateMany({
            where: {
              sectionHash: section.sectionHash,
              userId: { in: users.map((u) => u.id) },
            },
            data: {
              notifCount: { increment: 1 },
            },
          });

          return users.map(async (user) => {
            const sectionMessage = generateSectionMessage(section);
            const currFollowedSection = await prisma.followedSection.findFirst({
              where: {
                sectionHash: section.sectionHash,
                userId: user.id,
              },
            });
            const notifyer =
              currFollowedSection.notifCount < 3
                ? twilioNotifyer.sendNotificationText(
                    user.phoneNumber,
                    sectionMessage
                  )
                : twilioNotifyer.sendNotificationText(
                    user.phoneNumber,
                    `${sectionMessage} This is your 3rd alert; you are now unsubscribed from this notification.`
                  );
            return notifyer;
          });
        })
        .reduce((acc, val) => acc.concat(val), []);

    //delete any entries in followedCourse w/ notifCount >= 3
    await prisma.followedCourse.deleteMany({
      where: {
        notifCount: { gt: 2 },
      },
    });

    //delete any entries in followedSection w/ notifCount >= 3
    await prisma.followedSection.deleteMany({
      where: {
        notifCount: { gt: 2 },
      },
    });

    await Promise.all([...courseNotifPromises, ...sectionNotifPromises]).then(
      () => {
        macros.log("Notifications sent from notifyer!");
        return;
      }
    );
  }
}
