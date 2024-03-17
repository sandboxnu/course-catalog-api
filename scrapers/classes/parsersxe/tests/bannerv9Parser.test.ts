import { instance as bannerv9 } from "../bannerv9Parser";
import filters from "../../../filters";
import prisma from "../../../../services/prisma";
import TermParser from "../termParser";
import classParser from "../classParser";
import sectionParser from "../sectionParser";
import nock from "nock";

const scope = nock(/neu\.edu/)
  .get(/getTerms/)
  .reply(200, [
    {
      code: "3",
      description: "Fall 2022 Semester",
    },
    {
      code: "1",
      description: "Summer 2022 CPS Semester",
    },
    {
      code: "2",
      description: "Summer 2022 Law Semester",
    },
  ])
  .persist();

beforeEach(() => {
  delete process.env.CUSTOM_SCRAPE;
});

afterAll(() => {
  scope.persist(false);
  delete process.env.CUSTOM_SCRAPE;
  delete process.env.TERMS_TO_SCRAPE;
});

describe("getAllTermInfos", () => {
  it("serializes the term list", async () => {
    expect(await bannerv9.getAllTermInfos()).toEqual([
      {
        active: true,
        host: "neu.edu",
        subCollege: "NEU",
        termId: "3",
        text: "Fall 2022 Semester",
      },
      {
        active: true,
        host: "neu.edu",
        subCollege: "LAW",
        termId: "2",
        text: "Summer 2022 Semester",
      },
      {
        active: true,
        host: "neu.edu",
        subCollege: "CPS",
        termId: "1",
        text: "Summer 2022 Semester",
      },
    ]);
  });
});

describe("main", () => {
  it("customer termIds", async () => {
    const originalScrape = bannerv9.scrapeTerms;
    bannerv9.scrapeTerms = jest.fn();
    process.env.TERMS_TO_SCRAPE = "1";
    await bannerv9.main(["1"]);
    expect(bannerv9.scrapeTerms).toHaveBeenLastCalledWith(["1"]);

    delete process.env.TERMS_TO_SCRAPE;
    bannerv9.scrapeTerms = originalScrape;
  });

  it("custom scrape w/ truncate", async () => {
    process.env.CUSTOM_SCRAPE = "true";
    filters.truncate = true;

    prisma.course.deleteMany = jest.fn();
    prisma.section.deleteMany = jest.fn();
    prisma.$transaction = jest.fn();

    await bannerv9.main([]);
    expect(prisma.course.deleteMany).toHaveBeenCalled();
  });

  it("custom scrape without truncate", async () => {
    process.env.CUSTOM_SCRAPE = "true";
    filters.truncate = false;

    prisma.course.deleteMany = jest.fn();
    prisma.section.deleteMany = jest.fn();
    prisma.$transaction = jest.fn();

    await bannerv9.main([]);
    expect(prisma.course.deleteMany).not.toHaveBeenCalled();
  });
});

describe("scrapeTerms", () => {
  it("merges term datas", async () => {
    // @ts-expect-error -- don't care about the types here
    TermParser.parseTerm = jest.fn((p) => {
      const subjects = {};
      subjects[p] = p;
      return {
        classes: [p],
        sections: [p],
        subjects,
      };
    });
    expect(await bannerv9.scrapeTerms(["1", "2", "3"])).toEqual({
      classes: ["1", "2", "3"],
      sections: ["1", "2", "3"],
      subjects: { "1": "1", "2": "2", "3": "3" },
    });
  });
});

it("scrapeClass", async () => {
  // @ts-expect-error -- don't care about the types here
  classParser.parseClass = jest.fn((termId) => termId);
  // @ts-expect-error -- don't care about the types here
  sectionParser.parseSectionsOfClass = jest.fn((termId) => termId);

  expect(await bannerv9.scrapeClass("string", "", "")).toEqual({
    classes: ["string"],
    sections: "string",
  });

  // @ts-expect-error -- don't care about the types here
  expect(await bannerv9.scrapeClass(false, "", "")).toEqual({
    classes: [],
    sections: [],
  });
});
