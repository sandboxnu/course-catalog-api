import SectionParser from "../sectionParser";
import data from "./data/sectionParser.data";

beforeAll(() => {
  Date.now = jest.fn(() => 1578252414987) 
  // jest.spyOn(Date, "now").mockReturnValue(1578252414987);
  expect(Date.now()).toEqual(1578252414987);
});

describe("sectionParser", () => {
  const chem2311Section = SectionParser.parseSectionFromSearchResult(data.chem2311);
  const cs2500Section = SectionParser.parseSectionFromSearchResult(data.cs2500);
  it("should match snapshot", () => {
    // Snapshot test gives full coverage, but other tests also exist to clearly spec things out
    // DO NOT use the consts above - we need to create them inside the test case for the mock of Date.now() to work
    expect(SectionParser.parseSectionFromSearchResult(data.chem2311)).toMatchSnapshot();
    expect(SectionParser.parseSectionFromSearchResult(data.cs2500)).toMatchSnapshot();
  });

  it("should detect Honors", () => {
    expect(chem2311Section.honors).toBeTruthy();
    expect(cs2500Section.honors).toBeFalsy();
  });

  it("should detect campus", () => {
    expect(chem2311Section.campus).toBe("Online");
    expect(cs2500Section.campus).toBe("Boston");
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});
