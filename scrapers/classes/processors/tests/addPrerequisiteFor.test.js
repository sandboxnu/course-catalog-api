/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import Keys from "../../../../utils/keys";
import addPrerequisiteFor from "../addPrerequisiteFor";

describe("addPrerequisiteForFor tests", () => {
  const cs2500 = {
    prereqs: {
      type: "or",
      values: [
        {
          subject: "CS",
          classId: "3000",
        },
        "this is a string2",
      ],
    },
    classId: "2500",
    termId: "201829",
    subject: "CS",
    host: "neu.edu",
  };

  const cs3000 = {
    classId: "3000",
    termId: "201829",
    subject: "CS",
    host: "neu.edu",
  };

  const engw3302 = {
    prereqs: {
      type: "and",
      values: [
        {
          subject: "CS",
          classId: "2500",
        },
        "this is a string",
      ],
    },
    classId: "3302",
    termId: "201829",
    subject: "ENGW",
    host: "neu.edu",
  };
  const termDump = {
    classes: [cs2500, cs3000, engw3302],
    sections: [],
  };

  // it("should sort some optPrereqsFor", () => {
  //   addPrerequisiteFor.sortPrereqs(cs2500);
  //   expect(cs2500.prereqs).toMatchSnapshot();
  // });

  // it("should sort some prereqsFor", () => {
  //   addPrerequisiteFor.sortPrereqs(fakeClass2);
  //   expect(fakeClass2.prereqsFor).toMatchSnapshot();
  // });

  it("should parse prereqs", () => {
    addPrerequisiteFor.go(termDump);
    expect(termDump).toMatchSnapshot();
  });
});
