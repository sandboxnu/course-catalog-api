import { NotificationInfo } from "../../types/notifTypes";
import { sendNotifications } from "../../services/notifyer";
import twilioNotifyer from "../../twilio/notifs";
import { Prisma, User, Course as PrismaCourse } from "@prisma/client";
import dumpProcessor from "../../services/dumpProcessor";
import prisma from "../../services/prisma";
import {
  Course,
  Section,
  Requisite,
  convertBackendMeetingsToPrismaType,
} from "../../types/types";
import Keys from "../../utils/keys";

function processCourse(classInfo: Course): Prisma.CourseCreateInput {
  const additionalProps = {
    id: `${Keys.getClassHash(classInfo)}`,
    description: classInfo.desc,
    minCredits: Math.floor(classInfo.minCredits),
    maxCredits: Math.floor(classInfo.maxCredits),
    lastUpdateTime: new Date(classInfo.lastUpdateTime),
  };

  const correctedQuery = {
    ...classInfo,
    ...additionalProps,
    classAttributes: { set: classInfo.classAttributes || [] },
    nupath: { set: [] },
  };

  const { desc: _d, sections: _s, ...finalCourse } = correctedQuery;

  return finalCourse;
}

async function createSection(
  sec: Section,
  seatsRemaining: number,
  waitRemaining: number
): Promise<void> {
  await prisma.section.create({
    data: {
      classType: sec.classType,
      seatsCapacity: sec.seatsCapacity,
      waitCapacity: sec.waitCapacity,
      campus: sec.campus,
      honors: sec.honors,
      url: sec.url,
      id: Keys.getSectionHash(sec),
      crn: sec.crn,
      seatsRemaining,
      waitRemaining,
      info: "",
      meetings: convertBackendMeetingsToPrismaType(sec.meetings),
      profs: { set: sec.profs },
      course: { connect: { id: Keys.getClassHash(sec) } },
    },
  });
}

const mockSendNotificationText = jest.fn(() => {
  //console.log("I SHOULD BE CALLED");
  return Promise.resolve();
});

const SEMS_TO_UPDATE = ["202210"];

const EMPTY_REQ: Requisite = {
  type: "or",
  values: [],
};

const defaultClassProps = {
  host: "neu.edu",
  classAttributes: [],
  prettyUrl: "pretty",
  desc: "a class",
  url: "url",
  lastUpdateTime: 20,
  maxCredits: 4,
  minCredits: 0,
  coreqs: EMPTY_REQ,
  prereqs: EMPTY_REQ,
  feeAmount: 0,
  feeDescription: "",
};

const defaultSectionProps = {
  campus: "Boston",
  honors: false,
  url: "url",
  profs: [],
  meetings: [],
};

const USER_ONE = { id: 1, phoneNumber: "+11231231234" };
const USER_TWO = { id: 2, phoneNumber: "+19879879876" };

//courseHash: "neu.edu/202210/CS/2500",
//campus: "NEU",
const FUNDIES_ONE: Course = {
  classId: "2500",
  name: "Fundamentals of Computer Science 2",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  ...defaultClassProps,
};

//courseHash: "neu.edu/202210/ARTF/1122",
//campus: "NEU",
const ART: Course = {
  classId: "1122",
  name: "Principles of Programming Languages",
  termId: SEMS_TO_UPDATE[0],
  subject: "ARTF",
  ...defaultClassProps,
};

//sectionHash: "neu.edu/202210/CS/2500/11920",
//campus: "NEU",
const FUNDIES_ONE_S1: Section = {
  crn: "11920",
  classId: "2500",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 1,
  seatsRemaining: 114,
  waitCapacity: 0,
  waitRemaining: 0,
  lastUpdateTime: defaultClassProps.lastUpdateTime,
  host: defaultClassProps.host,
  ...defaultSectionProps,
};

beforeEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.useFakeTimers();
  jest.spyOn(dumpProcessor, "main").mockImplementation(() => {
    return Promise.resolve();
  });
  twilioNotifyer.sendNotificationText = mockSendNotificationText;
});

afterEach(async () => {
  await prisma.termInfo.deleteMany({});
  await prisma.followedCourse.deleteMany({});
  await prisma.followedSection.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.section.deleteMany({});
  await prisma.course.deleteMany({});

  jest.clearAllTimers();
});

afterAll(async () => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe("Notifyer", () => {
  describe("sendNotifications()", () => {
    let notificationInfo: NotificationInfo;
    let courseHashToUsers: Record<string, User[]>;
    let sectionHashToUsers: Record<string, User[]>;
    it("does not send anything where there are no updated courses and sections", async () => {
      notificationInfo = { updatedCourses: [], updatedSections: [] };
      courseHashToUsers = {};
      sectionHashToUsers = {};

      await sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );
      expect(mockSendNotificationText).toBeCalledTimes(0);
    });

    it("sends a notification for each course and section and for each user subscribed", async () => {
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

      await prisma.user.create({ data: USER_ONE });
      await prisma.user.create({ data: USER_TWO });
      await prisma.termInfo.create({
        data: {
          termId: "202210",
          subCollege: "NEU",
          text: "description",
        },
      });
      await prisma.course.create({
        data: processCourse(FUNDIES_ONE),
      });
      await prisma.course.create({
        data: processCourse(ART),
      });
      await createSection(FUNDIES_ONE_S1, 0, FUNDIES_ONE_S1.waitRemaining);
      await prisma.followedCourse.create({
        data: {
          courseHash: "neu.edu/202210/ARTF/1122",
          userId: 1,
        },
      });
      await prisma.followedCourse.create({
        data: {
          courseHash: "neu.edu/202210/ARTF/1122",
          userId: 2,
        },
      });
      await prisma.followedCourse.create({
        data: {
          courseHash: "neu.edu/202210/CS/2500",
          userId: 1,
          notifCount: 0,
        },
      });
      await prisma.followedSection.create({
        data: {
          sectionHash: "neu.edu/202210/CS/2500/11920",
          userId: 1,
          notifCount: 0,
        },
      });
      await prisma.followedSection.create({
        data: {
          sectionHash: "neu.edu/202210/CS/2500/11920",
          userId: 2,
          notifCount: 0,
        },
      });

      await sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );
      expect(mockSendNotificationText).toBeCalledTimes(5);
    });

    it("does not send a notification if no users are subscribed to the updated course/section", async () => {
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
      await sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );
      expect(mockSendNotificationText).toBeCalledTimes(0);
    });

    it("sends a properly formatted message when a new section is added to a course", async () => {
      //console.log("INSIDE TEST 2");
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
      await sendNotifications(
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

    it("sends a properly formatted message when multiple sections are added to a course", async () => {
      //console.log("INSIDE TEST 3");
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
      await sendNotifications(
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

    it("sends a properly formatted message when seats open up in a section", async () => {
      //console.log("INSIDE TEST 4");
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
      await sendNotifications(
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

    it("sends a properly formatted message when waitlist seats open up in a section", async () => {
      //console.log("INSIDE TEST 5");
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
      await sendNotifications(
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

    it("does not send any notifications for each course and section when each subscribed section and class has notifCount>=3", async () => {
      //console.log("TEST 6");

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
      await prisma.user.createMany({ data: [USER_ONE, USER_TWO] });
      await prisma.termInfo.create({
        data: {
          termId: "202210",
          subCollege: "NEU",
          text: "description",
        },
      });
      await prisma.course.createMany({
        data: [processCourse(FUNDIES_ONE), processCourse(ART)],
      });
      await createSection(FUNDIES_ONE_S1, 0, FUNDIES_ONE_S1.waitRemaining);
      await prisma.followedCourse.createMany({
        data: [
          {
            courseHash: "neu.edu/202210/ARTF/1122",
            userId: 1,
            notifCount: 3,
          },
          {
            courseHash: "neu.edu/202210/ARTF/1122",
            userId: 2,
            notifCount: 3,
          },
          {
            courseHash: "neu.edu/202210/CS/2500",
            userId: 1,
            notifCount: 3,
          },
        ],
      });
      await prisma.followedSection.createMany({
        data: [
          {
            sectionHash: "neu.edu/202210/CS/2500/11920",
            userId: 1,
            notifCount: 3,
          },
          {
            sectionHash: "neu.edu/202210/CS/2500/11920",
            userId: 2,
            notifCount: 3,
          },
        ],
      });

      courseHashToUsers = {};
      sectionHashToUsers = {};

      await sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );
      expect(mockSendNotificationText).toBeCalledTimes(0);
    });

    it("deletes subscriptions for each course and section when their notifCount>=3", async () => {
      //console.log("TEST 7");

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
      await prisma.user.createMany({ data: [USER_ONE, USER_TWO] });
      await prisma.termInfo.create({
        data: {
          termId: "202210",
          subCollege: "NEU",
          text: "description",
        },
      });
      await prisma.course.createMany({
        data: [processCourse(FUNDIES_ONE), processCourse(ART)],
      });

      await createSection(FUNDIES_ONE_S1, 0, FUNDIES_ONE_S1.waitRemaining);
      await prisma.followedCourse.createMany({
        data: [
          {
            courseHash: "neu.edu/202210/ARTF/1122",
            userId: 1,
            notifCount: 3,
          },
          {
            courseHash: "neu.edu/202210/ARTF/1122",
            userId: 2,
            notifCount: 3,
          },
          {
            courseHash: "neu.edu/202210/CS/2500",
            userId: 1,
            notifCount: 3,
          },
        ],
      });
      await prisma.followedSection.createMany({
        data: [
          {
            sectionHash: "neu.edu/202210/CS/2500/11920",
            userId: 1,
            notifCount: 3,
          },
          {
            sectionHash: "neu.edu/202210/CS/2500/11920",
            userId: 2,
            notifCount: 3,
          },
        ],
      });

      courseHashToUsers = {};
      sectionHashToUsers = {};

      const initialCourseNotifs = await prisma.followedCourse.count();
      expect(initialCourseNotifs).toEqual(3);
      const initialSectionNotifs = await prisma.followedSection.count();
      expect(initialSectionNotifs).toEqual(2);

      await sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );

      const remainingCourseNotifs = await prisma.followedCourse.count();
      expect(remainingCourseNotifs).toEqual(0);
      const remainingSectionNotifs = await prisma.followedSection.count();
      expect(remainingSectionNotifs).toEqual(0);
    });

    it("sends notifications for each course and section when each subscribed section and class has notifCount<3", async () => {
      //console.log("TEST 8");

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
      await prisma.user.createMany({ data: [USER_ONE, USER_TWO] });
      await prisma.termInfo.create({
        data: {
          termId: "202210",
          subCollege: "NEU",
          text: "description",
        },
      });
      await prisma.course.createMany({
        data: [processCourse(FUNDIES_ONE), processCourse(ART)],
      });

      await createSection(FUNDIES_ONE_S1, 0, FUNDIES_ONE_S1.waitRemaining);
      await prisma.followedCourse.createMany({
        data: [
          {
            courseHash: "neu.edu/202210/ARTF/1122",
            userId: 1,
            notifCount: 1,
          },
          {
            courseHash: "neu.edu/202210/ARTF/1122",
            userId: 2,
            notifCount: 0,
          },
          {
            courseHash: "neu.edu/202210/CS/2500",
            userId: 1,
            notifCount: 2,
          },
        ],
      });
      await prisma.followedSection.createMany({
        data: [
          {
            sectionHash: "neu.edu/202210/CS/2500/11920",
            userId: 1,
            notifCount: 1,
          },
          {
            sectionHash: "neu.edu/202210/CS/2500/11920",
            userId: 2,
            notifCount: 0,
          },
        ],
      });

      courseHashToUsers = {
        "neu.edu/202210/ARTF/1122": [
          { id: 1, phoneNumber: "+11231231234" },
          { id: 2, phoneNumber: "+19879879876" },
        ],
        "neu.edu/202210/CS/2500": [{ id: 1, phoneNumber: "+11231231234" }],
      };
      sectionHashToUsers = {
        "neu.edu/202210/CS/2500/11920": [
          { id: 1, phoneNumber: "+11231231234" },
          { id: 2, phoneNumber: "+19879879876" },
        ],
      };

      await sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );
      expect(mockSendNotificationText).toBeCalledTimes(5);
    });

    it("maintains subscriptions for each course and section when their notifCount<3", async () => {
      //console.log("TEST 9");

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
      await prisma.user.createMany({ data: [USER_ONE, USER_TWO] });
      await prisma.termInfo.create({
        data: {
          termId: "202210",
          subCollege: "NEU",
          text: "description",
        },
      });
      await prisma.course.createMany({
        data: [processCourse(FUNDIES_ONE), processCourse(ART)],
      });

      await createSection(FUNDIES_ONE_S1, 0, FUNDIES_ONE_S1.waitRemaining);
      await prisma.followedCourse.createMany({
        data: [
          {
            courseHash: "neu.edu/202210/ARTF/1122",
            userId: 1,
            notifCount: 1,
          },
          {
            courseHash: "neu.edu/202210/ARTF/1122",
            userId: 2,
            notifCount: 0,
          },
          {
            courseHash: "neu.edu/202210/CS/2500",
            userId: 1,
            notifCount: 2,
          },
        ],
      });
      await prisma.followedSection.createMany({
        data: [
          {
            sectionHash: "neu.edu/202210/CS/2500/11920",
            userId: 1,
            notifCount: 1,
          },
          {
            sectionHash: "neu.edu/202210/CS/2500/11920",
            userId: 2,
            notifCount: 0,
          },
        ],
      });

      courseHashToUsers = {
        "neu.edu/202210/ARTF/1122": [
          { id: 1, phoneNumber: "+11231231234" },
          { id: 2, phoneNumber: "+19879879876" },
        ],
        "neu.edu/202210/CS/2500": [{ id: 1, phoneNumber: "+11231231234" }],
      };
      sectionHashToUsers = {
        "neu.edu/202210/CS/2500/11920": [
          { id: 1, phoneNumber: "+11231231234" },
          { id: 2, phoneNumber: "+19879879876" },
        ],
      };

      const initialCourseNotifs = await prisma.followedCourse.count();
      expect(initialCourseNotifs).toEqual(3);
      const initialSectionNotifs = await prisma.followedSection.count();
      expect(initialSectionNotifs).toEqual(2);

      await sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );

      const remainingCourseNotifs = await prisma.followedCourse.count();
      expect(remainingCourseNotifs).toEqual(3);
      const remainingSectionNotifs = await prisma.followedSection.count();
      expect(remainingSectionNotifs).toEqual(2);
    });

    it("increases notifCount for each course and section after notif is sent", async () => {
      //console.log("TEST 7");

      notificationInfo = {
        updatedCourses: [
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
      await prisma.user.create({ data: USER_ONE });
      await prisma.termInfo.create({
        data: {
          termId: "202210",
          subCollege: "NEU",
          text: "description",
        },
      });
      await prisma.course.create({
        data: processCourse(FUNDIES_ONE),
      });
      await createSection(FUNDIES_ONE_S1, 0, FUNDIES_ONE_S1.waitRemaining);
      await prisma.followedCourse.create({
        data: {
          courseHash: "neu.edu/202210/CS/2500",
          userId: 1,
          notifCount: 0,
        },
      });
      await prisma.followedSection.create({
        data: {
          sectionHash: "neu.edu/202210/CS/2500/11920",
          userId: 1,
          notifCount: 1,
        },
      });

      courseHashToUsers = {
        "neu.edu/202210/CS/2500": [{ id: 1, phoneNumber: "+11231231234" }],
      };
      sectionHashToUsers = {
        "neu.edu/202210/CS/2500/11920": [
          { id: 1, phoneNumber: "+11231231234" },
        ],
      };

      const initialCourseNotifCount: { notifCount: number }[] =
        await prisma.followedCourse.findMany({
          where: { userId: 1 },
          select: { notifCount: true },
        });
      expect(initialCourseNotifCount).toEqual([{ notifCount: 0 }]);
      const initialSectionNotifCount = await prisma.followedSection.findMany({
        where: { userId: 1 },
        select: { notifCount: true },
      });
      expect(initialSectionNotifCount).toEqual([{ notifCount: 1 }]);

      await sendNotifications(
        notificationInfo,
        courseHashToUsers,
        sectionHashToUsers
      );

      const finalCourseNotifCount: { notifCount: number }[] =
        await prisma.followedCourse.findMany({
          where: { userId: 1 },
          select: { notifCount: true },
        });
      expect(finalCourseNotifCount).toEqual([{ notifCount: 1 }]);
      const finalSectionNotifCount = await prisma.followedSection.findMany({
        where: { userId: 1 },
        select: { notifCount: true },
      });
      expect(finalSectionNotifCount).toEqual([{ notifCount: 2 }]);
    });
  });
});
