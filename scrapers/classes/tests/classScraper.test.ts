import scraper from "../../main";
import prisma from "../../../services/prisma";

describe("getTermsIds", () => {
  beforeEach(() => {
    delete process.env.TERMS_TO_SCRAPE;
    delete process.env.NUMBER_OF_TERMS;
  });

  it("returns the termsStr if and only if they're in the terms list", async () => {
    process.env.TERMS_TO_SCRAPE = "202210,202230,202250";
    expect(await scraper.getTermIdsToScrape([])).toEqual([]);
    expect(await scraper.getTermIdsToScrape(["202210"])).toEqual(["202210"]);
    expect(
      await scraper.getTermIdsToScrape(["202210", "202230", "202250", "1234"])
    ).toEqual(["202210", "202230", "202250"]);
  });

  it("without a termStr, it takes NUMBER_OF_TERMS_TO_PARSE terms", async () => {
    process.env.NUMBER_OF_TERMS = "0";
    const termIds = new Array(10).fill("a");
    expect((await scraper.getTermIdsToScrape(termIds)).length).toBe(0);

    process.env.NUMBER_OF_TERMS = "5";
    expect((await scraper.getTermIdsToScrape(termIds)).length).toBe(5);

    process.env.NUMBER_OF_TERMS = "20";
    expect((await scraper.getTermIdsToScrape(termIds)).length).toBe(10);
  });

  describe("defaults to only terms which don't already exist in the DB", () => {
    let termIds: string[];
    beforeEach(() => {
      termIds = ["123", "456", "789", "000"];
    });

    it("returns all if there are no existing term IDs", async () => {
      // @ts-expect-error - the type isn't a PrismaPromise so TS will complain
      jest.spyOn(prisma.termInfo, "findMany").mockReturnValue([]);

      expect((await scraper.getTermIdsToScrape(termIds)).length).toBe(4);
    });

    it("returns those newer than those that already exist in the DB", async () => {
      const termsToReturn = [{ termId: "123" }, { termId: "456" }];
      // @ts-expect-error - the type isn't a PrismaPromise so TS will complain
      jest.spyOn(prisma.termInfo, "findMany").mockReturnValue(termsToReturn);

      const returnedTerms = await scraper.getTermIdsToScrape(termIds);
      expect(returnedTerms).toEqual(["789"]);
    });

    it("returns an empty list if all terms already exist", async () => {
      const termsToReturn = termIds.map((t) => ({ termId: t }));
      // @ts-expect-error - the type isn't a PrismaPromise so TS will complain
      jest.spyOn(prisma.termInfo, "findMany").mockReturnValue(termsToReturn);

      const returnedTerms = await scraper.getTermIdsToScrape(termIds);
      expect(returnedTerms).toEqual([]);
    });
  });
});
