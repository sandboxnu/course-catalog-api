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
        {
          subject: "not in term dump",
          classId: "1234",
        },
        "this is a string",
        {
          type: "or",
          values: [
            {
              subject: "CS",
              classId: "3000",
            },
            "this is a string2",
          ],
        },
      ],
    },
    classId: "3302",
    termId: "201829",
    subject: "ENGW",
    host: "neu.edu",
  };

  const cs1234 = {
    prereqs: {
      type: "or",
      values: [
        {
          subject: "CS",
          classId: "3000",
        },
      ],
    },
    classId: "1234",
    termId: "201829",
    subject: "CS",
    host: "neu.edu",
  };

  const termDump = {
    classes: [cs2500, cs3000, engw3302, cs1234],
    sections: [],
  };

  const cs2500Parsed = {
    ...JSON.parse(JSON.stringify(cs2500)),
    optPrereqsFor: {
      values: [],
    },
    prereqsFor: {
      values: [
        {
          classId: "3302",
          subject: "ENGW",
        },
      ],
    },
  };

  const cs3000Parsed = {
    ...JSON.parse(JSON.stringify(cs3000)),
    optPrereqsFor: {
      values: [
        {
          classId: "1234",
          subject: "CS",
        },
        {
          classId: "2500",
          subject: "CS",
        },
        {
          classId: "3302",
          subject: "ENGW",
        },
      ],
    },
    prereqsFor: {
      values: [],
    },
  };

  const engw3302Parsed = {
    ...JSON.parse(JSON.stringify(engw3302)),
    optPrereqsFor: {
      values: [],
    },
    prereqsFor: {
      values: [],
    },
  };

  const cs1234Parsed = {
    ...JSON.parse(JSON.stringify(cs1234)),
    optPrereqsFor: {
      values: [],
    },
    prereqsFor: {
      values: [],
    },
  };

  it("should parse prereqs", () => {
    addPrerequisiteFor.go(termDump);
    expect(termDump).toEqual({
      classes: [cs2500Parsed, cs3000Parsed, engw3302Parsed, cs1234Parsed],
      sections: [],
    });
  });

  it("should sort some optPrereqsFor", () => {
    const cs3000Sorted = {
      ...JSON.parse(JSON.stringify(cs3000)),
      optPrereqsFor: {
        values: [
          {
            classId: "3302",
            subject: "ENGW",
          },
          {
            classId: "2500",
            subject: "CS",
          },
          {
            classId: "1234",
            subject: "CS",
          },
        ],
      },
      prereqsFor: {
        values: [],
      },
    };
    addPrerequisiteFor.sortPrereqs(cs3000Sorted);
    expect(cs3000Sorted.optPrereqsFor).toEqual(cs3000Parsed.optPrereqsFor);
  });

  it("should sort some prereqsFor", () => {
    const cs2500Sorted = {
      ...JSON.parse(JSON.stringify(cs2500)),
      optPrereqsFor: {
        values: [],
      },
      prereqsFor: {
        values: [
          {
            classId: "3302",
            subject: "ENGW",
          },
        ],
      },
    };

    addPrerequisiteFor.sortPrereqs(cs2500Sorted);
    expect(cs2500Sorted.prereqsFor).toEqual(cs2500Parsed.prereqsFor);
  });
});
