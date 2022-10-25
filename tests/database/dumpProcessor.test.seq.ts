/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import prisma from "../../services/prisma";
import dumpProcessor from "../../services/dumpProcessor";
import elastic from "../../utils/elastic";
import { TermInfo } from "../../types/types";

jest.spyOn(elastic, "bulkIndexFromMap").mockResolvedValue(null);

beforeAll(() => {
  dumpProcessor.CHUNK_SIZE = 2;
});

beforeEach(async () => {
  await prisma.professor.deleteMany({});
  await prisma.section.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.subject.deleteMany({});
  await prisma.termInfo.deleteMany({});
});

afterAll(async () => {
  jest.restoreAllMocks();
});

const termInfos: TermInfo[] = [
  {
    termId: "123456",
    subCollege: "NEU",
    text: "This is some text",
  },
  {
    termId: "654321",
    subCollege: "LAW",
    text: "This is some more text",
  },
];

it("does not create records if dump is empty", async () => {
  const prevCounts = Promise.all([
    prisma.professor.count(),
    prisma.course.count(),
    prisma.section.count(),
    prisma.subject.count(),
    prisma.termInfo.count(),
  ]);
  await dumpProcessor.main({
    termDump: { classes: [], sections: [], subjects: {} },
  });
  expect(
    Promise.all([
      prisma.professor.count(),
      prisma.course.count(),
      prisma.section.count(),
      prisma.subject.count(),
      prisma.termInfo.count(),
    ])
  ).toEqual(prevCounts);
});

describe("with termInfos", () => {
  it("creates termInfos", async () => {
    await dumpProcessor.main({
      termDump: { classes: [], sections: [], subjects: {} },
      profDump: [],
      currentTermInfos: termInfos,
    });
    expect(await prisma.termInfo.count()).toEqual(2);
  });

  it("deletes old termInfos", async () => {
    await prisma.termInfo.create({
      data: {
        termId: "1",
        subCollege: "NEU",
        text: "hello",
      },
    });

    await dumpProcessor.main({
      termDump: { classes: [], sections: [], subjects: {} },
      profDump: [],
      currentTermInfos: termInfos,
    });
    expect(await prisma.termInfo.count()).toEqual(2);
  });

  it("updates existing termInfos", async () => {
    await prisma.termInfo.create({
      data: {
        termId: "654321",
        subCollege: "fake college",
        text: "This is some more text",
      },
    });

    expect(
      (
        await prisma.termInfo.findFirst({
          where: {
            termId: "654321",
          },
        })
      )?.subCollege
    ).toBe("fake college");

    await dumpProcessor.main({
      termDump: { classes: [], sections: [], subjects: {} },
      profDump: [],
      currentTermInfos: termInfos,
    });

    expect(await prisma.termInfo.count()).toEqual(2);
    expect(
      (
        await prisma.termInfo.findFirst({
          where: {
            termId: "654321",
          },
        })
      )?.subCollege
    ).toBe("LAW");
  });
});

describe("with professors", () => {
  it("creates professors", async () => {
    const profDump = [
      {
        id: "abcdefg",
        name: "Benjamin Lerner",
        firstName: "Benjamin",
        lastName: "Lerner",
        phone: "6173732462",
        email: "be.lerner@northeastern.edu",
        primaryRole: "Assistant Teaching Professor",
        primaryDepartment: "Khoury",
      },
      {
        id: "hijklmnop",
        name: "Neal Lerner",
        firstName: "Neal",
        lastName: "Lerner",
        phone: "6173732451",
        email: "n.lerner@northeastern.edu",
        primaryRole: "Professor & Chair",
        primaryDepartment: "English",
      },
      {
        id: "qrstuv",
        name: "Alan Mislove",
        firstName: "Alan",
        lastName: "Mislove",
        phone: "6173737069",
        email: "a.mislove@northeastern.edu",
        primaryRole: "Professor",
        primaryDepartment: "Khoury",
      },
    ];

    await dumpProcessor.main({
      termDump: { classes: [], sections: [], subjects: {} },
      profDump: profDump,
    });
    expect(await prisma.professor.count()).toEqual(3);
  });
});

describe("with classes", () => {
  it("creates classes", async () => {
    const termDump = {
      sections: [],
      classes: [
        {
          id: "neu.edu/202030/CS/2500",
          maxCredits: 4,
          minCredits: 4,
          host: "neu.edu",
          classId: "2500",
          name: "Fundamentals Of Computer Science 1",
          termId: "202030",
          subject: "CS",
          prereqs: { type: "and", values: [] },
          coreqs: { type: "and", values: [{ subject: "CS", classId: "2501" }] },
          prereqsFor: { type: "and", values: [] },
          optPrereqsFor: { type: "and", values: [] },
          classAttributes: ["fun intro"],
          lastUpdateTime: 123456789,
        },
        {
          id: "neu.edu/202030/CS/2510",
          maxCredits: 4,
          minCredits: 4,
          host: "neu.edu",
          classId: "2510",
          name: "Fundamentals Of Computer Science 2",
          termId: "202030",
          subject: "CS",
          prereqs: { type: "and", values: [] },
          coreqs: { type: "and", values: [] },
          prereqsFor: { type: "and", values: [] },
          optPrereqsFor: { type: "and", values: [] },
          lastUpdateTime: 123456789,
        },
        {
          id: "neu.edu/202030/CS/3500",
          maxCredits: 4,
          minCredits: 4,
          host: "neu.edu",
          classId: "3500",
          name: "Object-Oriented Design",
          termId: "202030",
          subject: "CS",
          lastUpdateTime: 123456789,
          honors: true,
        },
      ],
      subjects: [],
    };

    // @ts-ignore, missing some props but it doesn't matter
    await dumpProcessor.main({ termDump: termDump });
    expect(await prisma.course.count()).toEqual(3);
  });
});

describe("with sections", () => {
  beforeEach(async () => {
    await prisma.course.create({
      data: {
        id: "neu.edu/202030/CS/3500",
        maxCredits: 4,
        minCredits: 4,
        classId: "3500",
        name: "Object-Oriented Design",
        termId: "202030",
        subject: "CS",
        lastUpdateTime: new Date(123456789),
      },
    });
  });

  it("creates sections", async () => {
    const termDump = {
      classes: [],
      sections: [
        {
          host: "neu.edu",
          termId: "202030",
          subject: "CS",
          classId: "3500",
          seatsCapacity: 50,
          seatsRemaining: 0,
          waitCapacity: 0,
          waitRemaining: 0,
          campus: "Boston",
          honors: false,
          crn: "12345",
          meetings: {},
        },
        {
          host: "neu.edu",
          termId: "202030",
          subject: "CS",
          classId: "3500",
          seatsCapacity: 40,
          seatsRemaining: 10,
          campus: "Online",
          honors: false,
          crn: "23456",
          meetings: {},
        },
        {
          host: "neu.edu",
          termId: "202030",
          subject: "CS",
          classId: "3500",
          seatsCapacity: 2,
          seatsRemaining: 2,
          campus: "Seattle, WA",
          honors: false,
          crn: "34567",
          meetings: {},
        },
      ],
      subjects: [],
    };

    // @ts-ignore, missing some props but it doesn't matter
    await dumpProcessor.main({ termDump: termDump });
    expect(await prisma.section.count()).toEqual(3);
  });
});

describe("with subjects", () => {
  it("creates subjects", async () => {
    const termDump = {
      classes: [],
      sections: [],
      subjects: {
        CS: "Computer Science",
        CHEM: "Chemistry",
        PHYS: "Physics",
      },
    };
    await dumpProcessor.main({ termDump: termDump });
    expect(await prisma.subject.count()).toEqual(3);
  });
});

describe("with updates", () => {
  beforeEach(async () => {
    await prisma.course.create({
      data: {
        id: "neu.edu/202030/CS/3500",
        maxCredits: 4,
        minCredits: 4,
        classId: "3500",
        name: "Object-Oriented Design",
        termId: "202030",
        subject: "CS",
        lastUpdateTime: new Date(123456789),
      },
    });

    await prisma.section.create({
      data: {
        id: "neu.edu/202030/CS/3500/34567",
        seatsCapacity: 2,
        seatsRemaining: 2,
        campus: "Boston",
        honors: false,
        crn: "34567",
        meetings: {},
      },
    });

    await prisma.subject.create({
      data: {
        abbreviation: "CS",
        description: "Computer Science",
      },
    });
  });

  it("updates fields for courses", async () => {
    const termDump = {
      sections: [],
      classes: [
        {
          id: "neu.edu/202030/CS/3500",
          maxCredits: 4,
          minCredits: 4,
          host: "neu.edu",
          classId: "3500",
          name: "Compilers",
          termId: "202030",
          subject: "CS",
          lastUpdateTime: 123456789,
        },
      ],
      subjects: [],
    };

    // @ts-ignore, missing some props but it doesn't matter
    await dumpProcessor.main({ termDump: termDump });
    expect(await prisma.course.count()).toEqual(1);
    expect(await prisma.section.count()).toEqual(1);
    expect(await prisma.subject.count()).toEqual(1);
    expect(
      (
        await prisma.course.findUnique({
          where: { id: "neu.edu/202030/CS/3500" },
        })
      )?.name
    ).toEqual("Compilers");
  });

  it("updates subjects", async () => {
    const termDump = {
      sections: [],
      classes: [],
      subjects: {
        CS: "Computer Sciences",
      },
    };
    expect(
      (await prisma.subject.findUnique({ where: { abbreviation: "CS" } }))
        ?.description
    ).toEqual("Computer Science");
    await dumpProcessor.main({ termDump: termDump });
    expect(await prisma.course.count()).toEqual(1);
    expect(await prisma.section.count()).toEqual(1);
    expect(await prisma.subject.count()).toEqual(1);
    expect(
      (await prisma.subject.findUnique({ where: { abbreviation: "CS" } }))
        ?.description
    ).toEqual("Computer Sciences");
  });
});
