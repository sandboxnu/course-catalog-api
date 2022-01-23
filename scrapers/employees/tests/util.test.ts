import {
  standardizeEmail,
  standardizePhone,
  parseGoogleScholarLink,
  parseNameWithSpaces,
  getBaseHost,
  occurrences,
} from "../util";

it("standardize email works", () => {
  const input = standardizeEmail("mailto:b@google.com");
  expect(input).toEqual("b@google.com");
  expect(standardizeEmail("fdafdsa")).toEqual(null);
  expect(standardizeEmail("f@b.com")).toEqual("f@b.com");
});

it("standardizePhone works", () => {
  const input = standardizePhone("tel:5612547896");
  expect(input).toEqual("5612547896");

  const input2 = standardizePhone("tel:+15612547896");
  expect(input2).toEqual("5612547896");

  const input3 = standardizePhone("+15612547896");
  expect(input3).toEqual("5612547896");

  expect(standardizePhone("fdafdsa")).toEqual(null);
});

it("parseGoogleScolarLink works", () => {
  const url = "https://scholar.google.com/citations?user=aaaaaaa&hl=en&oi=ao";
  const input = parseGoogleScholarLink(url);
  expect(input).toEqual("aaaaaaa");

  const url2 = "https://scholar.google.com/oi=ao";
  const input2 = parseGoogleScholarLink(url2);
  expect(input2).toEqual(null);
});
it("should parse a name with spaces", () => {
  expect(parseNameWithSpaces("Bob    Ross")).toEqual({
    firstName: "Bob",
    lastName: "Ross",
  });

  expect(parseNameWithSpaces("   John    Ross    ")).toEqual({
    firstName: "John",
    lastName: "Ross",
  });
});

it("should parse some error", () => {
  expect(parseNameWithSpaces("A B C")).toEqual({
    firstName: "A",
    lastName: "C",
  });
});

it("it should parse a single letter", () => {
  expect(parseNameWithSpaces("E")).toEqual(null);
});

it("getBaseHost should work", () => {
  expect(getBaseHost("http://a.google.com")).toBe("google.com");
  expect(getBaseHost("fadjsl.google.com")).toBe(null);
  expect(getBaseHost("fdasfsdcom")).toBe(null);
});

it("occurrences should work", () => {
  expect(occurrences("a a a a b b b b", "a", false)).toBe(4);
  expect(occurrences("a a a a b b b b", "aaa", false)).toBe(0);
  expect(occurrences("onenenenenenenene bbbb", "nenen", true)).toBe(6);
});
