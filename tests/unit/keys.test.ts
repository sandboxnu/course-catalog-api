import { suite, test } from "node:test";

import Keys from "../../utils/keys";

suite("getHashWithKeysSlice", () => {
  test("no obj", (t) => {
    t.assert.equal(Keys.getHashWithKeysSlice(null, 0), null);
  });

  test("checks if all hash keys are present", (t) => {
    t.assert.equal(
      Keys.getHashWithKeysSlice({ host: "", termId: "" }, 3),
      null,
    );
    t.assert.equal(Keys.getHashWithKeysSlice({}, 1), null);
  });

  test("no output", (t) => {
    t.assert.equal(Keys.getHashWithKeysSlice({}, 0), "");
  });

  test("output keys", (t) => {
    t.assert.deepEqual(
      Keys.getHashWithKeysSlice({ host: "host name", termId: "1234" }, 2),
      "host_name/1234",
    );
    t.assert.deepEqual(
      Keys.getHashWithKeysSlice(
        { host: "northeastern", termId: "1234", subject: "computer science" },
        2,
      ),
      "northeastern/1234",
    );
    t.assert.deepEqual(
      Keys.getHashWithKeysSlice(
        { host: "northeastern", termId: "1234", subject: "computer science" },
        3,
      ),
      "northeastern/1234/computer_science",
    );
  });
});

test("getHostHash", (t) => {
  t.assert.deepEqual(
    Keys.getHostHash({
      host: "northeastern",
      termId: "1234",
      subject: "computer science",
    }),
    "northeastern",
  );
  t.assert.equal(Keys.getHostHash({ host: null }), null);
  t.assert.equal(Keys.getHostHash({}), null);
});

test("getTermHash", (t) => {
  t.assert.deepEqual(
    Keys.getTermHash({
      host: "northeastern",
      termId: "1234",
      subject: "computer science",
    }),
    "northeastern/1234",
  );
  t.assert.equal(Keys.getTermHash({}), null);
});

test("getSubjectHash", (t) => {
  t.assert.deepEqual(
    Keys.getSubjectHash({
      host: "northeastern",
      termId: "1234",
      subject: "computer science",
    }),
    "northeastern/1234/computer_science",
  );
  t.assert.equal(Keys.getSubjectHash({}), null);
});

test("getClassHash", (t) => {
  t.assert.deepEqual(
    Keys.getClassHash({
      host: "neu",
      termId: "1234",
      subject: "cs",
      classId: "id",
    }),
    "neu/1234/cs/id",
  );
  t.assert.equal(Keys.getClassHash({}), null);
});

test("getSectionHash", (t) => {
  t.assert.deepEqual(
    Keys.getSectionHash({
      host: "neu",
      termId: "1234",
      subject: "cs",
      classId: "id",
      crn: "crn",
    }),
    "neu/1234/cs/id/crn",
  );
  t.assert.equal(Keys.getSectionHash({}), null);
});

test("parseSectionHash", (t) => {
  const hash1 = {
    host: "neu",
    termId: "1234",
    subject: "cs",
    classId: "id",
    crn: "crn",
  };

  t.assert.deepEqual(Keys.parseSectionHash(Keys.getSectionHash(hash1)), hash1);
  t.assert.equal(Keys.parseSectionHash(""), null);
  t.assert.equal(Keys.parseSectionHash("neu/1234"), null);
});
