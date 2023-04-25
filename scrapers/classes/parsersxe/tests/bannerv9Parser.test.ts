import {
  instance as bannerv9,
  NUMBER_OF_TERMS_TO_UPDATE,
} from "../bannerv9Parser";
import filters from "../../../filters";
import prisma from "../../../../services/prisma";
import TermParser from "../termParser";
import classParser from "../classParser";
import sectionParser from "../sectionParser";
import nock from "nock";

const scope = nock("https://example.org")
  .get(/termslist$/)
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

afterAll(() => {
  scope.persist(false);
});

describe("getTermsIds", () => {
  beforeEach(() => {
    process.env.TERMS_TO_SCRAPE = "";
  });

  it("returns the termsStr if and only if they're in the terms list", () => {
    process.env.TERMS_TO_SCRAPE = "202210,202230,202250";
    expect(bannerv9.getTermsIds([])).toEqual([]);
    expect(bannerv9.getTermsIds(["202210"])).toEqual(["202210"]);
    expect(
      bannerv9.getTermsIds(["202210", "202230", "202250", "1234"])
    ).toEqual(["202210", "202230", "202250"]);
  });

  it("without a termStr, it takes NUMBER_OF_TERMS_TO_PARSE terms", () => {
    process.env.NUMBER_OF_TERMS = "0";
    const termIds = new Array(10).fill("a");
    expect(bannerv9.getTermsIds(termIds).length).toBe(0);

    process.env.NUMBER_OF_TERMS = "5";
    expect(bannerv9.getTermsIds(termIds).length).toBe(5);

    process.env.NUMBER_OF_TERMS = "20";
    expect(bannerv9.getTermsIds(termIds).length).toBe(10);
  });

  it("defaults to NUMEBR_OF_TERMS_TO_SCRAPE", () => {
    delete process.env.NUMBER_OF_TERMS;
    const termIds = new Array(30).fill("a");
    expect(bannerv9.getTermsIds(termIds).length).toBe(
      NUMBER_OF_TERMS_TO_UPDATE
    );
  });
});

describe("getAllTermInfos", () => {
  it("serializes the term list", async () => {
    expect(
      await bannerv9.getAllTermInfos("https://example.org/termslist")
    ).toEqual([
      {
        host: "neu.edu",
        subCollege: "NEU",
        termId: "3",
        text: "Fall 2022 Semester",
      },
      {
        host: "neu.edu",
        subCollege: "LAW",
        termId: "2",
        text: "Summer 2022 Semester",
      },
      {
        host: "neu.edu",
        subCollege: "CPS",
        termId: "1",
        text: "Summer 2022 Semester",
      },
    ]);
  });
});

describe("main", () => {
  it("customer termIds", () => {
    const originalScrape = bannerv9.scrapeTerms;
    bannerv9.scrapeTerms = jest.fn();
    process.env.TERMS_TO_SCRAPE = "1";
    bannerv9.main([
      {
        subCollege: "CPS",
        termId: "1",
        text: "Summer 2022 Semester",
      },
    ]);
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

it("getCurrentTermInfos", async () => {
  prisma.course.groupBy = jest.fn().mockReturnValueOnce([
    {
      termId: "4",
    },
    {
      termId: "2",
    },
    {
      termId: "1",
    },
  ]);

  expect(
    await bannerv9.getCurrentTermInfos([
      {
        subCollege: "NEU",
        termId: "3",
        text: "Fall 2022 Semester",
      },
      {
        subCollege: "LAW",
        termId: "2",
        text: "Summer 2022 Semester",
      },
      {
        subCollege: "CPS",
        termId: "1",
        text: "Summer 2022 Semester",
      },
    ])
  ).toEqual([
    {
      subCollege: "LAW",
      termId: "2",
      text: "Summer 2022 Semester",
    },
    {
      subCollege: "CPS",
      termId: "1",
      text: "Summer 2022 Semester",
    },
  ]);
});

describe("scrapeTerms", () => {
  it("merges term datas", async () => {
    // @ts-expect-error -- don't care about the types here
    TermParser.parseTerm = jest.fn((p, _p) => {
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
