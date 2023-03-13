import fs from "fs-extra";
import path from "path";
import cheerio from "cheerio";
import util from "../util.js";

describe("parseTable", () => {
  it("pulls out right data", async () => {
    const body = await fs.readFile(
      path.join(__dirname, "data", "util", "1.html"),
      "utf8"
    );

    const rawTable = cheerio.load(body)("table");
    const parsedTable = util.parseTable(rawTable);
    expect(parsedTable).toMatchSnapshot();
  });

  it("ignores columns too wide and blank cells", async () => {
    const body = await fs.readFile(
      path.join(__dirname, "data", "util", "2.html"),
      "utf8"
    );

    const rawTable = cheerio.load(body)("table");
    const parsedTable = util.parseTable(rawTable);
    expect(parsedTable).toMatchSnapshot();
  });

  it("uniquifies the head", async () => {
    const body = await fs.readFile(
      path.join(__dirname, "data", "util", "3.html"),
      "utf8"
    );

    const rawTable = cheerio.load(body)("table");
    const parsedTable = util.parseTable(rawTable);
    expect(parsedTable).toMatchSnapshot();
  });
});

it("uniquifies", () => {
  expect(util.uniquify(["1", "11"], "1")).toBe("12");
});

describe("parseTable", () => {
  it("table without name/table", () => {
    expect(util.parseTable([])).toEqual([]);
    expect(
      util.parseTable([
        {
          name: "not table",
        },
      ])
    ).toEqual([]);
  });

  it("table with no rows", () => {
    expect(
      util.parseTable([
        {
          name: "table",
          rows: [],
        },
      ])
    ).toEqual([]);
  });
});
