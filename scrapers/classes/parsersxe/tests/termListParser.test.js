import TermListParser from "../termListParser";
import nock from "nock";

nock(/.*/)
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

describe("termListParser", () => {
  it("pulls out relevant data", () => {
    const list = [
      {
        code: "202034",
        description: "Spring 2020 CPS Semester",
      },
      {
        code: "202032",
        description: "Spring 2020 Law Semester",
      },
      {
        code: "202030",
        description: "Spring 2020 Semester",
      },
    ];
    expect(TermListParser.serializeTermsList(list)).toMatchSnapshot();
  });
});
