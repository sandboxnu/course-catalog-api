import request from "../../../request";
import {
  instance as bannerv9,
  NUMBER_OF_TERMS_TO_UPDATE,
} from "../bannerv9Parser";

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
    expect(await bannerv9.getAllTermInfos("termslist")).toEqual([
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
