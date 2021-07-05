import _ from "lodash";
import { InputJsonValue } from "@prisma/client";
import Updater from "../services/updater";
import {
  Course as CourseType,
  Section as SectionType,
  Requisite,
} from "../types/types";
import prisma from "../services/prisma";
import Keys from "../utils/keys";
import dumpProcessor from "../services/dumpProcessor";
import termParser from "../scrapers/classes/parsersxe/termParser";

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
  lastUpdateTime: 20,
  maxCredits: 4,
  minCredits: 0,
  coreqs: EMPTY_REQ,
  prereqs: EMPTY_REQ,
};

const defaultSectionProps = {
  campus: "Boston",
  honors: false,
  url: "url",
  profs: [],
  meetings: [],
};

const FUNDIES_ONE: CourseType = {
  classId: "2500",
  name: "Fundamentals of Computer Science 1",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  ...defaultClassProps,
};

const FUNDIES_TWO: CourseType = {
  classId: "2510",
  name: "Fundamentals of Computer Science 2",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  ...defaultClassProps,
};

const PL: CourseType = {
  classId: "4400",
  name: "Principles of Programming Languages",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  ...defaultClassProps,
};

const FUNDIES_ONE_S1: SectionType = {
  crn: "1234",
  classId: "2500",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 1,
  seatsRemaining: 1,
  waitCapacity: 0,
  waitRemaining: 0,
  ...defaultClassProps,
  ...defaultSectionProps,
};

const FUNDIES_ONE_S2: SectionType = {
  crn: "5678",
  classId: "2500",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 100,
  seatsRemaining: 5,
  waitCapacity: 10,
  waitRemaining: 5,
  ...defaultClassProps,
  ...defaultSectionProps,
};

const FUNDIES_ONE_NEW_SECTION: SectionType = {
  crn: "2468",
  classId: "2500",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 100,
  seatsRemaining: 5,
  waitCapacity: 10,
  waitRemaining: 5,
  ...defaultClassProps,
  ...defaultSectionProps,
};

const FUNDIES_TWO_S1: SectionType = {
  crn: "0248",
  classId: "2510",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 200,
  seatsRemaining: 0,
  waitCapacity: 10,
  waitRemaining: 3,
  ...defaultClassProps,
  ...defaultSectionProps,
};

const FUNDIES_TWO_S2: SectionType = {
  crn: "1357",
  classId: "2510",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 150,
  seatsRemaining: 1,
  waitCapacity: 0,
  waitRemaining: 0,
  ...defaultClassProps,
  ...defaultSectionProps,
};

const FUNDIES_TWO_S3: SectionType = {
  crn: "9753",
  classId: "2510",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 150,
  seatsRemaining: 10,
  waitCapacity: 0,
  waitRemaining: 0,
  ...defaultClassProps,
  ...defaultSectionProps,
};

const PL_S1: SectionType = {
  crn: "0987",
  classId: "4400",
  classType: "lecture",
  termId: SEMS_TO_UPDATE[0],
  subject: "CS",
  seatsCapacity: 80,
  seatsRemaining: 25,
  waitCapacity: 0,
  waitRemaining: 0,
  ...defaultClassProps,
  ...defaultSectionProps,
};

const UPDATER: Updater = new Updater();
const mockSendUpdate = jest.fn();

beforeEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  jest.useFakeTimers();
  jest.spyOn(dumpProcessor, "main").mockImplementation(() => {
    return Promise.resolve();
  });
  jest.spyOn(UPDATER, "sendUpdates").mockImplementation(mockSendUpdate);
  await prisma.section.deleteMany({});
  await prisma.course.deleteMany({});
});

afterEach(async () => {
  jest.clearAllTimers();
});

function createSection(
  sec: SectionType,
  seatsRemaining: number,
  waitRemaining: number
) {
  return prisma.section.create({
    data: {
      ..._.omit(sec, [
        "classId",
        "termId",
        "subject",
        "host",
        "classAttributes",
        "prettyUrl",
        "desc",
        "lastUpdateTime",
        "maxCredits",
        "minCredits",
        "coreqs",
        "prereqs",
        "prereqsFor",
        "optPrereqsFor",
      ]), // FIXME very sus
      id: Keys.getSectionHash(sec),
      crn: sec.crn,
      seatsRemaining,
      waitRemaining,
      info: "",
      meetings: sec.meetings as unknown as InputJsonValue, // FIXME sus
      profs: { set: sec.profs },
      course: { connect: { id: Keys.getClassHash(sec) } },
    },
  });
}

describe("Updater", () => {
  it("scrapes the right terms to update", async () => {
    const mockTermParser = jest.fn(async () => {
      return [];
    });
    jest.spyOn(termParser, "parseSections").mockImplementation(mockTermParser);
    jest.spyOn(UPDATER, "getNotificationInfo").mockImplementation(async () => {
      return null;
    });

    await UPDATER.update();
    expect(mockTermParser.mock.calls.length).toBe(SEMS_TO_UPDATE.length);
    expect(mockTermParser.mock.calls).toEqual(
      SEMS_TO_UPDATE.map((termId) => [termId])
    );
  });

  describe("getNotificationInfo", () => {
    beforeEach(async () => {
      await prisma.course.create({
        data: dumpProcessor.processCourse(FUNDIES_ONE),
      });
      await prisma.course.create({
        data: dumpProcessor.processCourse(FUNDIES_TWO),
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

    it("does not include courses with no new sections to notifications", async () => {
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

    it("does include courses with new sections to notifications", async () => {
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

    it("does include sections with seat increase or waitlist increase", async () => {
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

    it("does not include sections that previously had seats", async () => {
      // insert 'old' sections into database
      await createSection(FUNDIES_ONE_S2, 5, 5);
      await createSection(FUNDIES_ONE_NEW_SECTION, 5, 5);
      const notificationInfo = await UPDATER.getNotificationInfo([
        { ...FUNDIES_ONE_S2, seatsRemaining: 6, waitRemaining: 6 },
        { ...FUNDIES_ONE_NEW_SECTION, seatsRemaining: 4, waitRemaining: 5 },
      ]);
      expect(notificationInfo).toEqual({
        updatedCourses: [],
        updatedSections: [],
      });
    });

    it("does not include sections with no change", async () => {
      const notificationInfo = await UPDATER.getNotificationInfo([
        { ...FUNDIES_TWO_S1, seatsRemaining: 0, waitRemaining: 0 },
      ]);
      expect(notificationInfo).toEqual({
        updatedCourses: [],
        updatedSections: [],
      });
    });
  });

  describe("everything but sendUpdate()", () => {
    beforeEach(async () => {
      await prisma.course.create({
        data: dumpProcessor.processCourse(FUNDIES_ONE),
      });
      await prisma.course.create({
        data: dumpProcessor.processCourse(FUNDIES_TWO),
      });

      await createSection(FUNDIES_ONE_S1, 0, FUNDIES_ONE_S1.waitRemaining);
      await createSection(FUNDIES_TWO_S1, 0, 0);
      await createSection(FUNDIES_TWO_S2, 0, 0);
      await createSection(
        FUNDIES_TWO_S3,
        FUNDIES_TWO_S3.seatsRemaining,
        FUNDIES_TWO_S3.waitRemaining
      );
    });

    it("calls sendUpdates() with the right notification info", async () => {
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

      const expectedNotification = {
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
        updatedSections: [
          {
            termId: FUNDIES_ONE_S1.termId,
            subject: FUNDIES_ONE_S1.subject,
            courseId: FUNDIES_ONE_S1.classId,
            crn: FUNDIES_ONE_S1.crn,
            sectionHash: Keys.getSectionHash(FUNDIES_ONE_S1),
            campus: Updater.getCampusFromTerm(FUNDIES_ONE.termId),
            seatsRemaining: FUNDIES_ONE_S1.seatsRemaining,
          },
          {
            termId: FUNDIES_TWO_S2.termId,
            subject: FUNDIES_TWO_S2.subject,
            courseId: FUNDIES_TWO_S2.classId,
            crn: FUNDIES_TWO_S2.crn,
            sectionHash: Keys.getSectionHash(FUNDIES_TWO_S2),
            campus: Updater.getCampusFromTerm(FUNDIES_TWO.termId),
            seatsRemaining: 0,
          },
        ],
      };
      await UPDATER.update();
      expect(mockSendUpdate.mock.calls.length).toBe(1);
      expect(mockSendUpdate.mock.calls[0][0]).toEqual(expectedNotification);
    });

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
        FUNDIES_ONE_S1.waitRemaining
      );
      const fundies2Sections = await prisma.section.findMany({
        where: { classHash: Keys.getClassHash(FUNDIES_TWO) },
      });
      expect(fundies2Sections.length).toBe(3);
      const fundies2Section1 = fundies2Sections.find(
        (section) => section.crn === FUNDIES_TWO_S1.crn
      );
      const fundies2Section2 = fundies2Sections.find(
        (section) => section.crn === FUNDIES_TWO_S2.crn
      );
      const fundies2Section3 = fundies2Sections.find(
        (section) => section.crn === FUNDIES_TWO_S3.crn
      );
      expect(fundies2Section1.seatsRemaining).toBe(0);
      expect(fundies2Section1.waitRemaining).toBe(0);
      expect(fundies2Section2.seatsRemaining).toBe(0);
      expect(fundies2Section2.waitRemaining).toBe(0);
      expect(fundies2Section3.seatsRemaining).toBe(
        FUNDIES_TWO_S3.seatsRemaining
      );
      expect(fundies2Section3.waitRemaining).toBe(FUNDIES_TWO_S3.waitRemaining);
      await UPDATER.update();

      // updates in database
      const fundies1SectionsUpdated = await prisma.section.findMany({
        where: { classHash: Keys.getClassHash(FUNDIES_ONE) },
      });
      expect(fundies1SectionsUpdated.length).toBe(2); // new fundies 1 section
      const fundies1Section1 = fundies1SectionsUpdated.find(
        (section) => section.crn === FUNDIES_ONE_S1.crn
      );
      expect(fundies1Section1.seatsRemaining).toBe(
        FUNDIES_ONE_S1.seatsRemaining
      );
      expect(fundies1Section1.waitRemaining).toBe(FUNDIES_ONE_S1.waitRemaining);

      const fundies2SectionsUpdated = await prisma.section.findMany({
        where: { classHash: Keys.getClassHash(FUNDIES_TWO) },
      });
      expect(fundies2SectionsUpdated.length).toBe(3);
      const fundies2Section1Updated = fundies2SectionsUpdated.find(
        (section) => section.crn === FUNDIES_TWO_S1.crn
      );
      const fundies2Section2Updated = fundies2SectionsUpdated.find(
        (section) => section.crn === FUNDIES_TWO_S2.crn
      );
      const fundies2Section3Updated = fundies2SectionsUpdated.find(
        (section) => section.crn === FUNDIES_TWO_S3.crn
      );
      expect(fundies2Section1Updated).toEqual(fundies2Section1); // no change
      expect(fundies2Section2Updated.seatsRemaining).toBe(0);
      expect(fundies2Section2Updated.waitRemaining).toBe(2);
      expect(fundies2Section3Updated.seatsRemaining).toBe(
        FUNDIES_TWO_S3.seatsRemaining - 2
      );
      expect(fundies2Section3Updated.waitRemaining).toBe(
        FUNDIES_TWO_S3.waitRemaining
      );
    });
  });
});
