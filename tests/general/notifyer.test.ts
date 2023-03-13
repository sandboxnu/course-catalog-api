import { NotificationInfo } from "../../types/notifTypes.js";
import { sendNotifications } from "../../services/notifyer.js";
import twilioNotifyer from "../../twilio/notifs.js";
import { User } from "@prisma/client";

const mockSendNotificationText = jest.fn(() => {
  return Promise.resolve();
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  twilioNotifyer.sendNotificationText = mockSendNotificationText;
});

describe("Notifyer", () => {
  describe("sendNotifications()", () => {
    let notificationInfo: NotificationInfo;
    let courseHashToUsers: Record<string, User[]>;
    let sectionHashToUsers: Record<string, User[]>;
    it("does not send anything where there are no updated courses and sections", () => {
      notificationInfo = { updatedCourses: [], updatedSections: [] };
      courseHashToUsers = {};
      sectionHashToUsers = {};
      sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );
      expect(mockSendNotificationText).toBeCalledTimes(0);
    });

    it("sends a notification for each course and section and for each user subscribed", () => {
      notificationInfo = {
        updatedCourses: [
          {
            termId: "202210",
            subject: "ARTF",
            courseId: "1122",
            courseHash: "neu.edu/202210/ARTF/1122",
            campus: "NEU",
            numberOfSectionsAdded: 1,
          },
          {
            termId: "202210",
            subject: "CS",
            courseId: "2500",
            courseHash: "neu.edu/202210/CS/2500",
            campus: "NEU",
            numberOfSectionsAdded: 1,
          },
        ],
        updatedSections: [
          {
            termId: "202210",
            subject: "CS",
            courseId: "2500",
            crn: "11920",
            sectionHash: "neu.edu/202210/CS/2500/11920",
            campus: "NEU",
            seatsRemaining: 114,
          },
        ],
      };
      courseHashToUsers = {
        "neu.edu/202210/ARTF/1122": [
          { id: 1, phoneNumber: "+11231231234" },
          { id: 2, phoneNumber: "+19879879876" },
        ],
        "neu.edu/202210/CS/2500": [{ id: 2, phoneNumber: "+19879879876" }],
      };
      sectionHashToUsers = {
        "neu.edu/202210/CS/2500/11920": [
          { id: 1, phoneNumber: "+11231231234" },
          { id: 2, phoneNumber: "+19879879876" },
        ],
      };
      sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );
      expect(mockSendNotificationText).toBeCalledTimes(5);
    });

    it("does not send a notification if no users are subscribed to the updated course/section", () => {
      notificationInfo = {
        updatedCourses: [
          {
            termId: "202210",
            subject: "ARTF",
            courseId: "1122",
            courseHash: "neu.edu/202210/ARTF/1122",
            campus: "NEU",
            numberOfSectionsAdded: 1,
          },
        ],
        updatedSections: [
          {
            termId: "202210",
            subject: "CS",
            courseId: "2500",
            crn: "11920",
            sectionHash: "neu.edu/202210/CS/2500/11920",
            campus: "NEU",
            seatsRemaining: 114,
          },
        ],
      };
      courseHashToUsers = {
        "neu.edu/202210/CS/2510": [
          { id: 1, phoneNumber: "+11231231234" },
          { id: 2, phoneNumber: "+19879879876" },
        ],
        "neu.edu/202210/CS/3500": [{ id: 2, phoneNumber: "+19879879876" }],
      };
      sectionHashToUsers = {
        "neu.edu/202210/CS/3500/12345": [
          { id: 1, phoneNumber: "+11231231234" },
          { id: 2, phoneNumber: "+19879879876" },
        ],
      };
      sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );
      expect(mockSendNotificationText).toBeCalledTimes(0);
    });

    it("sends a properly formatted message when a new section is added to a course", () => {
      notificationInfo = {
        updatedCourses: [
          {
            termId: "202210",
            subject: "ARTF",
            courseId: "1122",
            courseHash: "neu.edu/202210/ARTF/1122",
            campus: "NEU",
            numberOfSectionsAdded: 1,
          },
        ],
        updatedSections: [],
      };
      courseHashToUsers = {
        "neu.edu/202210/ARTF/1122": [{ id: 1, phoneNumber: "+11231231234" }],
      };
      sectionHashToUsers = {};
      sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );
      const expectedCourseMessage =
        "A section was added to ARTF 1122! Check it out at https://searchneu.com/NEU/202210/search/ARTF1122 !";
      expect(mockSendNotificationText).toHaveBeenCalledWith(
        "+11231231234",
        expectedCourseMessage
      );
    });

    it("sends a properly formatted message when multiple sections are added to a course", () => {
      notificationInfo = {
        updatedCourses: [
          {
            termId: "202210",
            subject: "ARTF",
            courseId: "1122",
            courseHash: "neu.edu/202210/ARTF/1122",
            campus: "NEU",
            numberOfSectionsAdded: 2,
          },
        ],
        updatedSections: [],
      };
      courseHashToUsers = {
        "neu.edu/202210/ARTF/1122": [{ id: 1, phoneNumber: "+11231231234" }],
      };
      sectionHashToUsers = {};
      sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );
      const expectedCourseMessage =
        "2 sections were added to ARTF 1122! Check it out at https://searchneu.com/NEU/202210/search/ARTF1122 !";
      expect(mockSendNotificationText).toHaveBeenCalledWith(
        "+11231231234",
        expectedCourseMessage
      );
    });

    it("sends a properly formatted message when seats open up in a section", () => {
      notificationInfo = {
        updatedCourses: [],
        updatedSections: [
          {
            termId: "202210",
            subject: "CS",
            courseId: "2500",
            crn: "11920",
            sectionHash: "neu.edu/202210/CS/2500/11920",
            campus: "NEU",
            seatsRemaining: 114,
          },
        ],
      };
      courseHashToUsers = {};
      sectionHashToUsers = {
        "neu.edu/202210/CS/2500/11920": [
          { id: 1, phoneNumber: "+11231231234" },
        ],
      };
      sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );
      const expectedSectionMessage =
        "A seat opened up in CS 2500 (CRN: 11920). Check it out at https://searchneu.com/NEU/202210/search/CS2500 !";
      expect(mockSendNotificationText).toHaveBeenCalledWith(
        "+11231231234",
        expectedSectionMessage
      );
    });

    it("sends a properly formatted message when waitlist seats open up in a section", () => {
      notificationInfo = {
        updatedCourses: [],
        updatedSections: [
          {
            termId: "202210",
            subject: "CS",
            courseId: "2500",
            crn: "11920",
            sectionHash: "neu.edu/202210/CS/2500/11920",
            campus: "NEU",
            seatsRemaining: 0,
          },
        ],
      };
      courseHashToUsers = {};
      sectionHashToUsers = {
        "neu.edu/202210/CS/2500/11920": [
          { id: 1, phoneNumber: "+11231231234" },
        ],
      };
      sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );
      const expectedSectionMessage =
        "A waitlist seat has opened up in CS 2500 (CRN: 11920). Check it out at https://searchneu.com/NEU/202210/search/CS2500 !";
      expect(mockSendNotificationText).toHaveBeenCalledWith(
        "+11231231234",
        expectedSectionMessage
      );
    });
  });
});
