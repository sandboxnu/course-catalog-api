import $ from "cheerio";
import _ from "lodash";
import Request from "../../request";
import macros from "../../../utils/macros";
import { CookieJar } from "tough-cookie";

const requestObj = new Request("util");

function validCell(el: cheerio.Element): boolean {
  return el.type === "tag" && ["th", "td"].includes(el.name);
}

/**
 * Modify a string to avoid collisions with set
 * @param {[String]} set array to avoid collisions with
 * @param {String} value String to uniquify
 * appends a number to end of the string such that it doesn't collide
 */
function uniquify(set: string[], value: string): string {
  if (set.includes(value)) {
    let append = 1;
    while (set.includes(value + append)) {
      append++;
    }
    return value + append;
  }
  return value;
}

/**
 * Parse a table using it's head (or first row) as keys
 * @param {Cheerio} table Cheerio object of table
 * @returns A list of {key: value} where key comes from header
 */
function parseTable(table: cheerio.Cheerio): Record<string, string>[] {
  // Empty table
  if (table.length !== 1) {
    return [];
  }
  // Non-table
  if (!("name" in table[0]) || table[0].name !== "table") {
    return [];
  }

  //includes both header rows and body rows
  const rows: cheerio.TagElement[] = $("tr", table).get();
  if (rows.length === 0) {
    macros.error("zero rows???");
    return [];
  }

  //the headers
  const heads: string[] = rows[0].children
    .filter(validCell)
    .reduce((acc: string[], element) => {
      const head: string = $(element)
        .text()
        .trim()
        .toLowerCase()
        .replace(/\s/gi, "");
      const uniqueHead = uniquify(acc, head);
      acc.push(uniqueHead);
      return acc;
    }, []);

  // add the other rows
  const ret: Record<string, string>[] = [];

  rows.slice(1).forEach((row: cheerio.TagElement) => {
    const values: string[] = row.children
      .filter(validCell)
      .map((el) => $(el).text());
    if (values.length > heads.length) {
      // TODO look into which classes trigger this
      macros.warn(
        "Table row is longer than head, ignoring some content",
        heads,
        values
      );
    }

    ret.push(_.zipObject(heads, values) as Record<string, string>);
  });

  return ret;
}

async function getCookiesForSearch(termId: string): Promise<CookieJar> {
  const cookieJar = new CookieJar();
  // first, get the cookies
  // https://jennydaman.gitlab.io/nubanned/dark.html#studentregistrationssb-clickcontinue-post
  const clickContinue = await requestObj.post(
    "https://nubanner.neu.edu/StudentRegistrationSsb/ssb/term/search?mode=search",
    {
      form: {
        term: termId,
      },
      cacheRequests: false,
      cookieJar: cookieJar,
    }
  );

  const bodyObj = JSON.parse(clickContinue.body);

  if (bodyObj.regAllowed === false) {
    macros.error(
      `failed to get cookies (from clickContinue) for the term ${termId}`,
      clickContinue.body
    );
  }

  for (const cookie of clickContinue.headers["set-cookie"]) {
    cookieJar.setCookie(
      cookie,
      "https://nubanner.neu.edu/StudentRegistrationSsb/"
    );
  }
  return cookieJar;
}

export default {
  parseTable: parseTable,
  getCookiesForSearch: getCookiesForSearch,
  uniquify: uniquify,
};
