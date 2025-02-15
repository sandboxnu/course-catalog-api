import Updater from "../../services/updater";
import {
  Course,
  Section,
  Requisite,
  convertBackendMeetingsToPrismaType,
} from "../../types/types";
import { ParsedCourseSR } from "../../types/scraperTypes";
import prisma from "../../services/prisma";
import { Prisma, Course as PrismaCourse } from "@prisma/client";
import Keys from "../../utils/keys";
import dumpProcessor from "../../services/dumpProcessor";
import termParser from "../../scrapers/classes/parsersxe/termParser";
import elasticInstance from "../../utils/elastic";
import classParser from "../../scrapers/classes/parsersxe/classParser";

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

const SEMS_TO_UPDATE = ["202210", "202160", "202154", "202150", "202140"];

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
  lastUpdateTime: Date.now(),
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

const FUNDIES_ONE: Course = {
  classId: "2500",
  name: "Fundamentals of Computer Science 1",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  ...defaultClassProps,
};

const FUNDIES_TWO: Course = {
  classId: "2510",
  name: "Fundamentals of Computer Science 2",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  ...defaultClassProps,
  prereqs: {
    classId: "2500",
    subject: "CS",
  },
};

const PL: Course = {
  classId: "4400",
  name: "Principles of Programming Languages",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  ...defaultClassProps,
  prereqs: {
    type: "and",
    values: [
      {
        classId: "2510",
        subject: "CS",
      },
      {
        classId: "9999",
        subject: "FAKE",
      },
    ],
  },
};

const FUNDIES_ONE_S1: Section = {
  crn: "1234",
  classId: "2500",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 1,
  seatsRemaining: 1,
  waitCapacity: 0,
  waitRemaining: 0,
  lastUpdateTime: defaultClassProps.lastUpdateTime,
  host: defaultClassProps.host,
  ...defaultSectionProps,
};

const FUNDIES_ONE_S2: Section = {
  crn: "5678",
  classId: "2500",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 100,
  seatsRemaining: 5,
  waitCapacity: 10,
  waitRemaining: 5,
  lastUpdateTime: defaultClassProps.lastUpdateTime,
  host: defaultClassProps.host,
  ...defaultSectionProps,
};

const FUNDIES_ONE_NEW_SECTION: Section = {
  crn: "2468",
  classId: "2500",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 100,
  seatsRemaining: 5,
  waitCapacity: 10,
  waitRemaining: 5,
  lastUpdateTime: defaultClassProps.lastUpdateTime,
  host: defaultClassProps.host,
  ...defaultSectionProps,
};

const FUNDIES_TWO_S1: Section = {
  crn: "0248",
  classId: "2510",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 200,
  seatsRemaining: 0,
  waitCapacity: 10,
  waitRemaining: 3,
  lastUpdateTime: defaultClassProps.lastUpdateTime,
  host: defaultClassProps.host,
  ...defaultSectionProps,
};

const FUNDIES_TWO_S2: Section = {
  crn: "1357",
  classId: "2510",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 150,
  seatsRemaining: 1,
  waitCapacity: 0,
  waitRemaining: 0,
  lastUpdateTime: defaultClassProps.lastUpdateTime,
  host: defaultClassProps.host,
  ...defaultSectionProps,
};

const FUNDIES_TWO_S3: Section = {
  crn: "9753",
  classId: "2510",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 150,
  seatsRemaining: 10,
  waitCapacity: 0,
  waitRemaining: 0,
  lastUpdateTime: defaultClassProps.lastUpdateTime,
  host: defaultClassProps.host,
  ...defaultSectionProps,
};

const PL_S1: Section = {
  crn: "0987",
  classId: "4400",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 80,
  seatsRemaining: 25,
  waitCapacity: 0,
  waitRemaining: 0,
  lastUpdateTime: defaultClassProps.lastUpdateTime,
  host: defaultClassProps.host,
  ...defaultSectionProps,
};

const USER_ONE = { id: 1, phoneNumber: "+11231231234" };
const USER_TWO = { id: 2, phoneNumber: "+19879879876" };

const UPDATER: Updater = new Updater(SEMS_TO_UPDATE);
// const mockSendNotification = jest.fn(() => {
//   return Promise.resolve();
// });

beforeEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.useFakeTimers();
  jest.spyOn(dumpProcessor, "main").mockImplementation(() => {
    return Promise.resolve();
  });

  // jest.mock("../services/notifyer.ts", () => ({
  //   __esModule: true,
  //   sendNotifications: mockSendNotification,
  // }));

  await prisma.user.create({ data: USER_ONE });
  await prisma.user.create({ data: USER_TWO });
  await prisma.termInfo.create({
    data: {
      termId: "202210",
      subCollege: "NEU",
      text: "description",
    },
  });
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

async function createSection(
  sec: Section,
  seatsRemaining: number,
  waitRemaining: number,
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

describe("Updater", () => {
  it("gets the expected campus from term IDs", () => {
    expect(Updater.getCampusFromTerm("202210")).toBe("NEU");
    expect(Updater.getCampusFromTerm("202230")).toBe("NEU");
    expect(Updater.getCampusFromTerm("unknown")).toBe("NEU");
    expect(Updater.getCampusFromTerm("")).toBe("NEU");

    expect(Updater.getCampusFromTerm("202235")).toBe("CPS");
    expect(Updater.getCampusFromTerm("202234")).toBe("CPS");

    expect(Updater.getCampusFromTerm("202222")).toBe("LAW");
    expect(Updater.getCampusFromTerm("202228")).toBe("LAW");
  });

  it("scrapes the right terms to update", async () => {
    const mockTermParser = jest.fn(async () => {
      return [];
    });
    jest.spyOn(termParser, "parseSections").mockImplementation(mockTermParser);
    jest.spyOn(UPDATER, "getNotificationInfo").mockImplementation(async () => {
      return { updatedCourses: [], updatedSections: [] };
    });

    await UPDATER.update();
    expect(mockTermParser.mock.calls.length).toBe(SEMS_TO_UPDATE.length);
    expect(mockTermParser.mock.calls).toEqual(
      SEMS_TO_UPDATE.map((termId) => [termId]),
    );
  });

  it("inactive terms aren't saved in the updater", async () => {
    const INACTIVE_TERM = "000000";
    const ACTIVE_TERM = "000001";
    let termIdsToUpdate = await Updater.getTermIdsToUpdate();
    // Shouldn't include these termId
    expect(termIdsToUpdate).not.toContain(INACTIVE_TERM);
    expect(termIdsToUpdate).not.toContain(ACTIVE_TERM);

    // Create an inactive term in database
    await prisma.termInfo.create({
      data: {
        termId: INACTIVE_TERM,
        subCollege: "NEU",
        text: "description",
        active: false,
      },
    });

    termIdsToUpdate = await Updater.getTermIdsToUpdate();

    // Still shouldn't include this inactive term
    expect(termIdsToUpdate).not.toContain(INACTIVE_TERM);
    // Create an active term
    await prisma.termInfo.create({
      data: {
        termId: ACTIVE_TERM,
        subCollege: "NEU",
        text: "description",
        active: true,
      },
    });
    termIdsToUpdate = await Updater.getTermIdsToUpdate();
    // Should include the active term
    expect(termIdsToUpdate).toContain(ACTIVE_TERM);
  });

  describe("getNotificationInfo", () => {
    let FUNDIES_ONE_COURSE;
    let FUNDIES_TWO_COURSE;
    beforeEach(async () => {
      FUNDIES_ONE_COURSE = processCourse(FUNDIES_ONE);
      FUNDIES_TWO_COURSE = processCourse(FUNDIES_TWO);
      await prisma.course.create({
        data: FUNDIES_ONE_COURSE,
      });
      await prisma.course.create({
        data: FUNDIES_TWO_COURSE,
      });

      await createSection(FUNDIES_ONE_S1, 0, FUNDIES_ONE_S1.waitRemaining);
      await createSection(FUNDIES_TWO_S1, 0, 0);
      await createSection(FUNDIES_TWO_S2, 0, 0);
    });

    it("does not care about new section for class that does not exist", async () => {
      const notificationInfo = await UPDATER.getNotificationInfo([PL_S1]);
      expect(notificationInfo).toEqual({
        updatedCourses: [],
        updatedSections: [],
      });
    });

    it("does not include watched courses with no new sections to notifications", async () => {
      await prisma.followedCourse.create({
        data: { courseHash: FUNDIES_ONE_COURSE.id, userId: 1 },
      });
      await prisma.followedCourse.create({
        data: { courseHash: FUNDIES_TWO_COURSE.id, userId: 1 },
      });
      const notificationInfo = await UPDATER.getNotificationInfo([
        { ...FUNDIES_ONE_S1, seatsRemaining: 0 },
        { ...FUNDIES_TWO_S1, seatsRemaining: 0, waitRemaining: 0 },
        { ...FUNDIES_TWO_S2, seatsRemaining: 0, waitRemaining: 0 },
      ]);
      expect(notificationInfo).toEqual({
        updatedCourses: [],
        updatedSections: [],
      });
    });

    it("does include watched courses with new sections to notifications", async () => {
      await prisma.followedCourse.create({
        data: { courseHash: FUNDIES_ONE_COURSE.id, userId: 1 },
      });
      const notificationInfo = await UPDATER.getNotificationInfo([
        FUNDIES_ONE_NEW_SECTION,
      ]);
      expect(notificationInfo).toEqual({
        updatedCourses: [
          {
            termId: FUNDIES_ONE.termId,
            subject: FUNDIES_ONE.subject,
            courseId: FUNDIES_ONE.classId,
            courseHash: Keys.getClassHash(FUNDIES_ONE),
            campus: Updater.getCampusFromTerm(FUNDIES_ONE.termId),
            numberOfSectionsAdded: 1,
          },
        ],
        updatedSections: [],
      });
    });

    it("does not include unwatched courses with new sections to notifications", async () => {
      await prisma.followedCourse.create({
        data: { courseHash: FUNDIES_TWO_COURSE.id, userId: 1 },
      });
      const notificationInfo = await UPDATER.getNotificationInfo([
        FUNDIES_ONE_NEW_SECTION,
      ]);
      expect(notificationInfo).toEqual({
        updatedCourses: [],
        updatedSections: [],
      });
    });

    it("does include watched sections with seat increase or waitlist increase", async () => {
      await prisma.followedSection.create({
        data: { sectionHash: Keys.getSectionHash(FUNDIES_ONE_S1), userId: 1 },
      });
      await prisma.followedSection.create({
        data: { sectionHash: Keys.getSectionHash(FUNDIES_TWO_S1), userId: 2 },
      });
      await prisma.followedSection.create({
        data: { sectionHash: Keys.getSectionHash(FUNDIES_TWO_S2), userId: 2 },
      });
      const seatIncrease = { ...FUNDIES_ONE_S1, seatsRemaining: 2 };
      const waitlistIncrease = {
        ...FUNDIES_TWO_S1,
        seatsRemaining: 0,
        waitRemaining: 1,
      };
      const seatWaitlistIncrease = {
        ...FUNDIES_TWO_S2,
        seatsRemaining: 1,
        waitRemaining: 2,
      };
      const notificationInfo = await UPDATER.getNotificationInfo([
        seatIncrease,
        waitlistIncrease,
        seatWaitlistIncrease,
      ]);
      expect(notificationInfo).toEqual({
        updatedCourses: [],
        updatedSections: [
          {
            termId: FUNDIES_ONE_S1.termId,
            subject: FUNDIES_ONE_S1.subject,
            courseId: FUNDIES_ONE_S1.classId,
            crn: FUNDIES_ONE_S1.crn,
            sectionHash: Keys.getSectionHash(FUNDIES_ONE_S1),
            campus: Updater.getCampusFromTerm(FUNDIES_ONE.termId),
            seatsRemaining: 2,
          },
          {
            termId: FUNDIES_TWO_S1.termId,
            subject: FUNDIES_TWO_S1.subject,
            courseId: FUNDIES_TWO_S1.classId,
            crn: FUNDIES_TWO_S1.crn,
            sectionHash: Keys.getSectionHash(FUNDIES_TWO_S1),
            campus: Updater.getCampusFromTerm(FUNDIES_TWO.termId),
            seatsRemaining: FUNDIES_TWO_S1.seatsRemaining,
          },
          {
            termId: FUNDIES_TWO_S2.termId,
            subject: FUNDIES_TWO_S2.subject,
            courseId: FUNDIES_TWO_S2.classId,
            crn: FUNDIES_TWO_S2.crn,
            sectionHash: Keys.getSectionHash(FUNDIES_TWO_S2),
            campus: Updater.getCampusFromTerm(FUNDIES_TWO.termId),
            seatsRemaining: 1,
          },
        ],
      });
    });

    it("does not include unwatched sections with seat increase or waitlist increase", async () => {
      const seatIncrease = { ...FUNDIES_ONE_S1, seatsRemaining: 2 };
      const waitlistIncrease = {
        ...FUNDIES_TWO_S1,
        seatsRemaining: 0,
        waitRemaining: 1,
      };
      const seatWaitlistIncrease = {
        ...FUNDIES_TWO_S2,
        seatsRemaining: 1,
        waitRemaining: 2,
      };
      const notificationInfo = await UPDATER.getNotificationInfo([
        seatIncrease,
        waitlistIncrease,
        seatWaitlistIncrease,
      ]);
      expect(notificationInfo).toEqual({
        updatedCourses: [],
        updatedSections: [],
      });
    });

    it("does not include watched sections that previously had seats", async () => {
      // insert 'old' sections into database
      await createSection(FUNDIES_ONE_S2, 5, 5);
      await createSection(FUNDIES_ONE_NEW_SECTION, 5, 5);
      await prisma.followedSection.create({
        data: { sectionHash: Keys.getSectionHash(FUNDIES_ONE_S2), userId: 1 },
      });
      await prisma.followedSection.create({
        data: {
          sectionHash: Keys.getSectionHash(FUNDIES_ONE_NEW_SECTION),
          userId: 2,
        },
      });
      const notificationInfo = await UPDATER.getNotificationInfo([
        { ...FUNDIES_ONE_S2, seatsRemaining: 6, waitRemaining: 6 },
        { ...FUNDIES_ONE_NEW_SECTION, seatsRemaining: 4, waitRemaining: 5 },
      ]);
      expect(notificationInfo).toEqual({
        updatedCourses: [],
        updatedSections: [],
      });
    });

    it("does not include watched sections with no change", async () => {
      await prisma.followedSection.create({
        data: { sectionHash: Keys.getSectionHash(FUNDIES_TWO_S1), userId: 2 },
      });
      const notificationInfo = await UPDATER.getNotificationInfo([
        { ...FUNDIES_TWO_S1, seatsRemaining: 0, waitRemaining: 0 },
      ]);
      expect(notificationInfo).toEqual({
        updatedCourses: [],
        updatedSections: [],
      });
    });
  });

  describe("update", () => {
    let FUNDIES_ONE_COURSE;
    let FUNDIES_TWO_COURSE;
    beforeEach(async () => {
      FUNDIES_ONE_COURSE = processCourse(FUNDIES_ONE);
      FUNDIES_TWO_COURSE = processCourse(FUNDIES_TWO);
      await prisma.course.create({
        data: FUNDIES_ONE_COURSE,
      });
      await prisma.course.create({
        data: FUNDIES_TWO_COURSE,
      });

      await createSection(FUNDIES_ONE_S1, 0, FUNDIES_ONE_S1.waitRemaining);
      await createSection(FUNDIES_TWO_S1, 0, 0);
      await createSection(FUNDIES_TWO_S2, 0, 0);
      await createSection(
        FUNDIES_TWO_S3,
        FUNDIES_TWO_S3.seatsRemaining,
        FUNDIES_TWO_S3.waitRemaining,
      );
    });

    // it("calls sendNotifications() with the right notification info", async () => {
    //   jest
    //     .spyOn(termParser, "parseSections")
    //     .mockImplementation(async (termId) => {
    //       const sections = [
    //         FUNDIES_ONE_S1, // more seats
    //         FUNDIES_ONE_NEW_SECTION, // new fundies 1 section
    //         { ...FUNDIES_TWO_S1, seatsRemaining: 0, waitRemaining: 0 }, // no change
    //         { ...FUNDIES_TWO_S2, seatsRemaining: 0, waitRemaining: 2 }, // 2 more wait seats
    //         {
    //           ...FUNDIES_TWO_S3,
    //           seatsRemaining: FUNDIES_TWO_S3.seatsRemaining - 2,
    //         }, // seat decrease
    //       ];
    //       return sections.filter((section) => section.termId === termId);
    //     });
    //   await prisma.followedCourse.create({
    //     data: { courseHash: FUNDIES_ONE_COURSE.id, userId: 1 },
    //   });
    //   await prisma.followedCourse.create({
    //     data: { courseHash: FUNDIES_ONE_COURSE.id, userId: 2 },
    //   });
    //   await prisma.followedSection.create({
    //     data: { sectionHash: Keys.getSectionHash(FUNDIES_ONE_S1), userId: 1 },
    //   });
    //   await prisma.followedSection.create({
    //     data: { sectionHash: Keys.getSectionHash(FUNDIES_TWO_S1), userId: 2 },
    //   });
    //   await prisma.followedSection.create({
    //     data: { sectionHash: Keys.getSectionHash(FUNDIES_TWO_S2), userId: 1 },
    //   });
    //   await prisma.followedSection.create({
    //     data: { sectionHash: Keys.getSectionHash(FUNDIES_TWO_S2), userId: 2 },
    //   });
    //   await prisma.followedSection.create({
    //     data: { sectionHash: Keys.getSectionHash(FUNDIES_TWO_S3), userId: 2 },
    //   });
    //   const expectedNotification = {
    //     updatedCourses: [
    //       {
    //         termId: FUNDIES_ONE.termId,
    //         subject: FUNDIES_ONE.subject,
    //         courseId: FUNDIES_ONE.classId,
    //         courseHash: Keys.getClassHash(FUNDIES_ONE),
    //         campus: Updater.getCampusFromTerm(FUNDIES_ONE.termId),
    //         numberOfSectionsAdded: 1,
    //       },
    //     ],
    //     updatedSections: [
    //       {
    //         termId: FUNDIES_ONE_S1.termId,
    //         subject: FUNDIES_ONE_S1.subject,
    //         courseId: FUNDIES_ONE_S1.classId,
    //         crn: FUNDIES_ONE_S1.crn,
    //         sectionHash: Keys.getSectionHash(FUNDIES_ONE_S1),
    //         campus: Updater.getCampusFromTerm(FUNDIES_ONE.termId),
    //         seatsRemaining: FUNDIES_ONE_S1.seatsRemaining,
    //       },
    //       {
    //         termId: FUNDIES_TWO_S2.termId,
    //         subject: FUNDIES_TWO_S2.subject,
    //         courseId: FUNDIES_TWO_S2.classId,
    //         crn: FUNDIES_TWO_S2.crn,
    //         sectionHash: Keys.getSectionHash(FUNDIES_TWO_S2),
    //         campus: Updater.getCampusFromTerm(FUNDIES_TWO.termId),
    //         seatsRemaining: 0,
    //       },
    //     ],
    //   };
    //   const expectedCourseHashToUser = {
    //     [FUNDIES_ONE_COURSE.id]: [USER_ONE, USER_TWO],
    //   };
    //   const expectedSectionHashToUser = {
    //     [Keys.getSectionHash(FUNDIES_ONE_S1)]: [USER_ONE],
    //     [Keys.getSectionHash(FUNDIES_TWO_S1)]: [USER_TWO],
    //     [Keys.getSectionHash(FUNDIES_TWO_S2)]: [USER_ONE, USER_TWO],
    //     [Keys.getSectionHash(FUNDIES_TWO_S3)]: [USER_TWO],
    //   };
    //   await UPDATER.update();
    //   expect(mockSendNotification.mock.calls.length).toBe(1);
    //   expect(mockSendNotification.mock.calls[0]).toEqual([
    //     expectedNotification,
    //     expectedCourseHashToUser,
    //     expectedSectionHashToUser,
    //   ]);
    // });

    it("updates the database", async () => {
      jest.spyOn(dumpProcessor, "main").mockRestore();
      jest
        .spyOn(termParser, "parseSections")
        .mockImplementation(async (termId) => {
          const sections = [
            FUNDIES_ONE_S1, // more seats
            FUNDIES_ONE_NEW_SECTION, // new fundies 1 section
            { ...FUNDIES_TWO_S1, seatsRemaining: 0, waitRemaining: 0 }, // no change
            { ...FUNDIES_TWO_S2, seatsRemaining: 0, waitRemaining: 2 }, // 2 more wait seats
            {
              ...FUNDIES_TWO_S3,
              seatsRemaining: FUNDIES_TWO_S3.seatsRemaining - 2,
            }, // seat decrease
          ];
          return sections.filter((section) => section.termId === termId);
        });
      // before updating and running the dump processor
      const fundies1Sections = await prisma.section.findMany({
        where: { classHash: Keys.getClassHash(FUNDIES_ONE) },
      });
      expect(fundies1Sections.length).toBe(1);
      expect(fundies1Sections[0].seatsRemaining).toBe(0);
      expect(fundies1Sections[0].waitRemaining).toBe(
        FUNDIES_ONE_S1.waitRemaining,
      );
      const fundies2Sections = await prisma.section.findMany({
        where: { classHash: Keys.getClassHash(FUNDIES_TWO) },
      });
      expect(fundies2Sections.length).toBe(3);
      const fundies2Section1 = fundies2Sections.find(
        (section) => section.crn === FUNDIES_TWO_S1.crn,
      );
      const fundies2Section2 = fundies2Sections.find(
        (section) => section.crn === FUNDIES_TWO_S2.crn,
      );
      const fundies2Section3 = fundies2Sections.find(
        (section) => section.crn === FUNDIES_TWO_S3.crn,
      );
      expect(fundies2Section1.seatsRemaining).toBe(0);
      expect(fundies2Section1.waitRemaining).toBe(0);
      expect(fundies2Section2.seatsRemaining).toBe(0);
      expect(fundies2Section2.waitRemaining).toBe(0);
      expect(fundies2Section3.seatsRemaining).toBe(
        FUNDIES_TWO_S3.seatsRemaining,
      );
      expect(fundies2Section3.waitRemaining).toBe(FUNDIES_TWO_S3.waitRemaining);

      jest.spyOn(elasticInstance, "bulkIndexFromMap").mockImplementation(() => {
        return Promise.resolve();
      });
      await UPDATER.update();
      jest.spyOn(elasticInstance, "bulkIndexFromMap").mockRestore();

      // updates in database
      const fundies1SectionsUpdated = await prisma.section.findMany({
        where: { classHash: Keys.getClassHash(FUNDIES_ONE) },
      });

      expect(fundies1SectionsUpdated.length).toBe(2); // new fundies 1 section
      const fundies1Section1 = fundies1SectionsUpdated.find(
        (section) => section.crn === FUNDIES_ONE_S1.crn,
      );
      expect(fundies1Section1.seatsRemaining).toBe(
        FUNDIES_ONE_S1.seatsRemaining,
      );
      expect(fundies1Section1.waitRemaining).toBe(FUNDIES_ONE_S1.waitRemaining);

      const fundies2SectionsUpdated = await prisma.section.findMany({
        where: { classHash: Keys.getClassHash(FUNDIES_TWO) },
      });
      expect(fundies2SectionsUpdated.length).toBe(3);
      const fundies2Section1Updated = fundies2SectionsUpdated.find(
        (section) => section.crn === FUNDIES_TWO_S1.crn,
      );
      const fundies2Section2Updated = fundies2SectionsUpdated.find(
        (section) => section.crn === FUNDIES_TWO_S2.crn,
      );
      const fundies2Section3Updated = fundies2SectionsUpdated.find(
        (section) => section.crn === FUNDIES_TWO_S3.crn,
      );
      expect({
        ...fundies2Section1Updated,
        lastUpdateTime: "changed",
      }).toEqual({
        ...fundies2Section1,
        lastUpdateTime: "changed",
      }); // no change except for lastUpdateTime
      expect(fundies2Section1Updated.lastUpdateTime).not.toBe(
        fundies2Section1.lastUpdateTime,
      );
      expect(fundies2Section2Updated.seatsRemaining).toBe(0);
      expect(fundies2Section2Updated.waitRemaining).toBe(2);
      expect(fundies2Section3Updated.seatsRemaining).toBe(
        FUNDIES_TWO_S3.seatsRemaining - 2,
      );
      expect(fundies2Section3Updated.waitRemaining).toBe(
        FUNDIES_TWO_S3.waitRemaining,
      );
    });
  });

  it("Creates an updater instance", async () => {
    const updater = await Updater.create();
    expect(updater.SEMS_TO_UPDATE).toEqual(["202210"]);

    const updateEnv = process.env.UPDATE_ONLY_ONCE;
    process.env.UPDATE_ONLY_ONCE = "true";

    jest.spyOn(updater, "update").mockImplementationOnce(async () => {
      // do nothing
    });

    await updater.start();

    expect(updater.update).toHaveBeenCalled();

    process.env.UPDATE_ONLY_ONCE = updateEnv;
  });

  describe("Scrapes missing classes", () => {
    let FUNDIES_ONE_COURSE;

    const getCourse = async (course: Course): Promise<PrismaCourse | null> => {
      return await prisma.course.findFirst({
        where: { id: { equals: Keys.getClassHash(course) } },
      });
    };

    const isCourseInDB = async (course: Course): Promise<boolean> => {
      return (await getCourse(course)) !== null;
    };

    beforeEach(async () => {
      jest.spyOn(dumpProcessor, "main").mockRestore();
      jest.spyOn(elasticInstance, "bulkIndexFromMap").mockImplementation(() => {
        return Promise.resolve();
      });

      FUNDIES_ONE_COURSE = processCourse(FUNDIES_ONE);
      await prisma.course.create({
        data: FUNDIES_ONE_COURSE,
      });

      jest
        .spyOn(classParser, "parseClass")
        .mockImplementation(async (termId, subject, classId) => {
          if (
            subject === FUNDIES_TWO.subject &&
            classId === FUNDIES_TWO.classId
          ) {
            return { ...FUNDIES_TWO, termId } as ParsedCourseSR;
          } else if (subject === PL.subject && classId === PL.classId) {
            return { ...PL, termId } as ParsedCourseSR;
          } else {
            throw `Only ${FUNDIES_TWO.subject}${FUNDIES_TWO.classId} should be used in these tests - something's wrong (${termId}/${subject}/${classId})`;
          }
        });
    });

    it("Scrapes a missing class corresponding to a section", async () => {
      jest
        .spyOn(termParser, "parseSections")
        .mockImplementation(async (termId) => {
          const sections = [FUNDIES_ONE_S1, FUNDIES_TWO_S1, FUNDIES_TWO_S2];
          return sections.filter((section) => section.termId === termId);
        });

      expect(await isCourseInDB(FUNDIES_TWO)).toBe(false);
      await UPDATER.update();
      // After running the updater, the class should exist
      expect(await isCourseInDB(FUNDIES_TWO)).toBe(true);
      expect(classParser.parseClass).toHaveBeenCalledWith(
        FUNDIES_TWO_S1.termId,
        FUNDIES_TWO_S1.subject,
        FUNDIES_TWO_S1.classId,
      );
      expect((await prisma.section.findMany()).length).toBe(3);

      // Ensure that all the prerequisites are NOT marked as missing
      const fundies2 = await getCourse(FUNDIES_TWO);

      expect(fundies2?.prereqs?.["values"]).toEqual([
        { classId: FUNDIES_ONE.classId, subject: FUNDIES_ONE.subject },
      ]);

      const fundies1 = await getCourse(FUNDIES_ONE);

      expect(fundies1?.prereqsFor).toEqual([
        { classId: FUNDIES_TWO.classId, subject: FUNDIES_TWO.subject },
      ]);
    });

    it("will not scrape missing classes with termIDs which aren't already saved", async () => {
      jest
        .spyOn(termParser, "parseSections")
        .mockImplementation(async (termId) => {
          if (termId === FUNDIES_TWO_S1.termId) {
            return [FUNDIES_TWO_S1];
          } else if (termId === SEMS_TO_UPDATE[1]) {
            // This term has no classes saved, so this section should be ignored
            return [{ ...PL_S1, termId: SEMS_TO_UPDATE[1] }];
          } else {
            return [];
          }
        });

      expect(await isCourseInDB(FUNDIES_TWO)).toBe(false);
      expect(await isCourseInDB(PL)).toBe(false);
      await UPDATER.update();
      // After running the updater, the class should exist
      expect(await isCourseInDB(FUNDIES_TWO)).toBe(true);
      expect(await isCourseInDB(PL)).toBe(false);

      expect((await prisma.section.findMany()).length).toBe(1);
    });

    it("Scrapes all missing classes", async () => {
      jest
        .spyOn(termParser, "parseSections")
        .mockImplementation(async (termId) => {
          const sections = [FUNDIES_ONE_S1, FUNDIES_TWO_S1, PL_S1];
          return sections.filter((section) => section.termId === termId);
        });

      expect(await isCourseInDB(FUNDIES_TWO)).toBe(false);
      expect(await isCourseInDB(PL)).toBe(false);

      await UPDATER.update();

      expect(await isCourseInDB(FUNDIES_TWO)).toBe(true);
      expect(await isCourseInDB(PL)).toBe(true);

      expect((await prisma.section.findMany()).length).toBe(3);

      const fundies1 = await getCourse(FUNDIES_ONE);

      expect(fundies1?.prereqsFor).toEqual([
        { classId: FUNDIES_TWO.classId, subject: FUNDIES_TWO.subject },
      ]);

      const fundies2 = await getCourse(FUNDIES_TWO);

      expect(fundies2?.prereqs?.["values"]).toEqual([
        { classId: FUNDIES_ONE.classId, subject: FUNDIES_ONE.subject },
      ]);
      expect(fundies2?.prereqsFor).toEqual([
        { classId: PL.classId, subject: PL.subject },
      ]);

      const pl = await getCourse(PL);
      expect(pl?.prereqs?.["values"]).toEqual([
        { classId: FUNDIES_TWO.classId, subject: FUNDIES_TWO.subject },
        { classId: "9999", subject: "FAKE", missing: true },
      ]);
      expect(pl?.prereqsFor).toEqual([]);
    });

    it("will not save sections if their corresponding classes couldn't be scraped", async () => {
      jest
        .spyOn(classParser, "parseClass")
        .mockImplementation(async () => false);

      jest
        .spyOn(termParser, "parseSections")
        .mockImplementation(async (termId) => {
          const sections = [FUNDIES_ONE_S1, FUNDIES_TWO_S1];
          return sections.filter((section) => section.termId === termId);
        });

      expect(await isCourseInDB(FUNDIES_TWO)).toBe(false);

      await UPDATER.update();

      expect(await isCourseInDB(FUNDIES_TWO)).toBe(false);
      expect((await prisma.section.findMany()).length).toBe(1);
    });
  });
});
