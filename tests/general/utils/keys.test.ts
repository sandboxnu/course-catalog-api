import Keys from "../../../utils/keys.js";

describe("getHashWithKeysSlice", () => {
  it("no obj", () => {
    expect(Keys.getHashWithKeysSlice(null, 0)).toBeNull();
  });

  it("checks if all hash keys are present", () => {
    expect(Keys.getHashWithKeysSlice({ host: "", termId: "" }, 3)).toBeNull();
    expect(Keys.getHashWithKeysSlice({}, 1)).toBeNull();
  });

  it("no output", () => {
    expect(Keys.getHashWithKeysSlice({}, 0)).toBe("");
  });

  it("output keys", () => {
    expect(
      Keys.getHashWithKeysSlice({ host: "host name", termId: "1234" }, 2)
    ).toBe("host_name/1234");
    expect(
      Keys.getHashWithKeysSlice(
        { host: "northeastern", termId: "1234", subject: "computer science" },
        2
      )
    ).toBe("northeastern/1234");
    expect(
      Keys.getHashWithKeysSlice(
        { host: "northeastern", termId: "1234", subject: "computer science" },
        3
      )
    ).toBe("northeastern/1234/computer_science");
  });
});

it("getHostHash", () => {
  expect(
    Keys.getHostHash({
      host: "northeastern",
      termId: "1234",
      subject: "computer science",
    })
  ).toBe("northeastern");
  expect(Keys.getHostHash({ host: null })).toBeNull();
  expect(Keys.getHostHash({})).toBeNull();
});

it("getTermHash", () => {
  expect(
    Keys.getTermHash({
      host: "northeastern",
      termId: "1234",
      subject: "computer science",
    })
  ).toBe("northeastern/1234");
  expect(Keys.getTermHash({})).toBeNull();
});

it("getSubjectHash", () => {
  expect(
    Keys.getSubjectHash({
      host: "northeastern",
      termId: "1234",
      subject: "computer science",
    })
  ).toBe("northeastern/1234/computer_science");
  expect(Keys.getSubjectHash({})).toBeNull();
});

it("getClassHash", () => {
  expect(
    Keys.getClassHash({
      host: "neu",
      termId: "1234",
      subject: "cs",
      classId: "id",
    })
  ).toBe("neu/1234/cs/id");
  expect(Keys.getClassHash({})).toBeNull();
});

it("getSectionHash", () => {
  expect(
    Keys.getSectionHash({
      host: "neu",
      termId: "1234",
      subject: "cs",
      classId: "id",
      crn: "crn",
    })
  ).toBe("neu/1234/cs/id/crn");
  expect(Keys.getSectionHash({})).toBeNull();
});

it("parseSectionHash", () => {
  const hash1 = {
    host: "neu",
    termId: "1234",
    subject: "cs",
    classId: "id",
    crn: "crn",
  };

  expect(Keys.parseSectionHash(Keys.getSectionHash(hash1))).toStrictEqual(
    hash1
  );
  expect(Keys.parseSectionHash("")).toBeNull;
  expect(Keys.parseSectionHash("neu/1234")).toBeNull;
});
