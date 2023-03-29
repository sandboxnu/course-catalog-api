/* eslint-disable no-underscore-dangle */
import * as subject from "../subjectAbbreviationParser";
import nock from "nock";

const scope = nock("https://nubanner.neu.edu")
  .get(/term=termsTest/)
  .reply(200, [
    {
      code: "ACCT",
      description: "Accounting",
    },
    {
      code: "AVM",
      description: "Adv Manufacturing System - CPS",
    },
  ])
  .persist();

afterAll(() => {
  scope.persist(false);
});

describe("subjectAbbreviationParser", () => {
  it("_createDescriptionTable builds mapping", () => {
    const banner = [
      {
        code: "ACCT",
        description: "Accounting",
      },
      {
        code: "AVM",
        description: "Adv Manufacturing System - CPS",
      },
    ];
    const map = {
      Accounting: "ACCT",
      "Adv Manufacturing System - CPS": "AVM",
    };
    expect(subject._createDescriptionTable(banner)).toEqual(map);
  });

  it("_createAbbrTable builds mapping", () => {
    const banner = [
      {
        code: "ACCT",
        description: "Accounting",
      },
      {
        code: "AVM",
        description: "Adv Manufacturing System - CPS",
      },
    ];
    const map = {
      ACCT: "Accounting",
      AVM: "Adv Manufacturing System - CPS",
    };
    expect(subject._createAbbrTable(banner)).toEqual(map);
  });

  it("requesting subjects", async () => {
    expect(await subject.getSubjectDescriptions("termsTest")).toEqual({
      ACCT: "Accounting",
      AVM: "Adv Manufacturing System - CPS",
    });

    expect(await subject.getSubjectAbbreviations("termsTest")).toEqual({
      Accounting: "ACCT",
      "Adv Manufacturing System - CPS": "AVM",
    });
  });
});
