import scraper, { NUMBER_OF_TERMS_TO_UPDATE } from "../../main";

describe("getTermsIds", () => {
  beforeEach(() => {
    process.env.TERMS_TO_SCRAPE = "";
  });

  it("returns the termsStr if and only if they're in the terms list", () => {
    process.env.TERMS_TO_SCRAPE = "202210,202230,202250";
    expect(scraper.getTermIdsToScrape([])).toEqual([]);
    expect(scraper.getTermIdsToScrape(["202210"])).toEqual(["202210"]);
    expect(
      scraper.getTermIdsToScrape(["202210", "202230", "202250", "1234"])
    ).toEqual(["202210", "202230", "202250"]);
  });

  it("without a termStr, it takes NUMBER_OF_TERMS_TO_PARSE terms", () => {
    process.env.NUMBER_OF_TERMS = "0";
    const termIds = new Array(10).fill("a");
    expect(scraper.getTermIdsToScrape(termIds).length).toBe(0);

    process.env.NUMBER_OF_TERMS = "5";
    expect(scraper.getTermIdsToScrape(termIds).length).toBe(5);

    process.env.NUMBER_OF_TERMS = "20";
    expect(scraper.getTermIdsToScrape(termIds).length).toBe(10);
  });

  it("defaults to NUMEBR_OF_TERMS_TO_SCRAPE", () => {
    delete process.env.NUMBER_OF_TERMS;
    const termIds = new Array(30).fill("a");
    expect(scraper.getTermIdsToScrape(termIds).length).toBe(
      NUMBER_OF_TERMS_TO_UPDATE
    );
  });
});
