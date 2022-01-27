/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import { User } from "@prisma/client";
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
      .map((course) => {
        const courseMessage = generateCourseMessage(course);
        return courseHashToUsers[course.courseHash].map((user) => {
          return twilioNotifyer.sendNotificationText(
            user.phoneNumber,
            courseMessage
          );
        });
      })
      .reduce((acc, val) => acc.concat(val), []);

    const sectionNotifPromises: Promise<void>[] =
      notificationInfo.updatedSections
        .map((section) => {
          const sectionMessage = generateSectionMessage(section);
          return sectionHashToUsers[section.sectionHash].map((user) => {
            return twilioNotifyer.sendNotificationText(
              user.phoneNumber,
              sectionMessage
            );
          });
        })
        .reduce((acc, val) => acc.concat(val), []);

    await Promise.all([...courseNotifPromises, ...sectionNotifPromises]).then(
      () => {
        macros.log("Notifications sent from notifyer!");
        return;
      }
    );
  }
}
