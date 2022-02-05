/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import { Parser, DomHandler } from "htmlparser2";
import { removeElement, getElementsByTagName, textContent } from "domutils";
import _ from "lodash";
import cookie from "cookie";
import he from "he";

import { Response } from "request";
import Request from "../request";
import cache from "../cache";
import macros from "../../utils/macros";
import { occurrences, standardizeEmail } from "./util";
import { Employee } from "../../types/types";

const request = new Request("Employees");

// Scrapes from here: https://prod-web.neu.edu/wasapp/employeelookup/public/main.action

// TODO:
// Some of the phone numbers are not 10 digits. Might be able to guess area code, but it is not allways 215 just because some people have offices outside of Boston.
// Phone numbers that are not 10 digits are ignored right now.
// The detail page also has a name without the comma, but don't see a reason on scraping that instead of just splitting on comma and moving.
// Is that name ever different than the one with the comma?
// Their office is also in that detail page, but it seems like if is often different than the ones the professors have
// on their CCIS/COE/CSSH profile. Unsure if it would be worth scraping that too.

// Currently:
// Name is always scraped. This can vary slightly between different data sources.
// This name will never include accents, which the CCIS site does
// Also, multiple people have the same name so this can not be used as a primary key
// "name": "Hauck, Heather",

// Id of each employee. Always scraped.
// In Aug, 2019 this id was changed from a decimal to a base64 encoded binary string on NEU's site.
// "id": "%2B9Yas6J4nmbQ0e8J7Ju54Q%3D%3D",

// Phone number. Some people had them posted and others did not. Sometimes present, sometimes not.
// The same phone number can be listed as one person's phone number on this data source and a different person on a different data source.
// Don't have a great idea on how to handle that.
// "phone": "6173737821",

// Email. Sometimes present, sometimes not.
// "email": "h.hauck@northeastern.edu",

// Sometimes present, sometimes not. Often heavily abbreviated. (like this example)
// "primaryappointment": "Asst Dir &amp; Assoc Coop Coord",

// Always scraped.
// "primarydepartment": "DMSB Co-op"

// Should be done better here:
// employees.parseLettersResponse should be stateless, and just return some json from the html it processes
// and employees.parseLettersResponse should be sync, and not async
// and we could get rid of domutils too lmao

class NeuEmployee {
  people: Employee[];
  couldNotFindNameList: Record<string, boolean>;
  cookiePromise: null | string;

  constructor() {
    this.people = [];
    this.couldNotFindNameList = {};
    this.cookiePromise = null;
  }

  handleRequestResponse(
    body: string,
    callback: (error: Error | null, dom: any[]) => void
  ): void {
    const handler = new DomHandler(callback);
    const parser = new Parser(handler);
    parser.write(body);
    parser.end();
  }

  //returns a {colName:[values]} where colname is the first in the column
  //regardless if its part of the header or the first row of the body
  parseTable(
    table: any
  ): null | { rowCount: number; parsedTable: Record<string, unknown> } {
    if (table.name !== "table") {
      macros.error("parse table was not given a table..");
      return null;
    }

    //includes both header rows and body rows
    const rows = getElementsByTagName("tr", table);

    if (rows.length === 0) {
      return null;
    }

    const retVal = {};
    const heads = [];

    //the headers
    rows[0].children.forEach((element) => {
      if (element.type !== "tag" || ["th", "td"].indexOf(element.name) === -1) {
        return;
      }

      const text = textContent(element)
        .trim()
        .toLowerCase()
        .replace(/\s/gi, "");
      retVal[text] = [];
      heads.push(text);
    });

    //add the other rows
    rows.slice(1).forEach((row) => {
      let index = 0;
      row.children.forEach((element) => {
        if (
          element.type !== "tag" ||
          ["th", "td"].indexOf(element.name) === -1
        ) {
          return;
        }
        if (index >= heads.length) {
          macros.warn(
            "Table row is longer than head, ignoring content",
            index,
            heads,
            rows
          );
          return;
        }

        retVal[heads[index]].push(textContent(element).trim());

        //only count valid elements, not all row.children
        index++;
      });

      //add empty strings until reached heads length
      for (; index < heads.length; index++) {
        retVal[heads[index]].push("");
      }
    });
    return {
      rowCount: rows.length - 1,
      parsedTable: retVal,
    };
  }

  async getCookiePromise(): Promise<string> {
    if (this.cookiePromise) {
      return this.cookiePromise;
    }

    macros.verbose("neu employee getting cookie");

    this.cookiePromise = await request
      .get({
        url: "https://prod-web.neu.edu/wasapp/employeelookup/public/main.action",
      })
      .then((resp) => {
        // Parse the cookie from the response
        const cookieString = resp.headers["set-cookie"][0];
        const cookies = cookie.parse(cookieString);
        return cookies.JSESSIONID;
      });

    return this.cookiePromise;
  }

  hitWithLetters(
    lastNameStart: string,
    jsessionCookie: string
  ): Promise<Response> {
    return request.get({
      url: `https://prod-web.neu.edu/wasapp/employeelookup/public/searchEmployees.action?searchBy=Last+Name&queryType=begins+with&searchText=${lastNameStart}&deptText=&addrText=&numText=&divText=&facStaff=2`,
      headers: {
        Cookie: `JSESSIONID=${jsessionCookie}`,
      },
    });
  }

  // Given a list of things, will find the first one that is longer than 1 letter (a-z)
  findName(list: string[], referenceName: string): string {
    for (let i = 0; i < list.length; i++) {
      const noSymbols = list[i].toLowerCase().replace(/[^0-9a-zA-Z]/gi, "");

      if (
        noSymbols.length > 1 &&
        !["ii", "iii", "jr", "sr", "dr"].includes(noSymbols)
      ) {
        return list[i];
      }
    }

    // Only log each warning once, just to not spam the macros. This method is called a lot.
    const logMatchString = list.join("");
    if (this.couldNotFindNameList[logMatchString]) {
      return null;
    }
    this.couldNotFindNameList[logMatchString] = true;

    macros.warn(
      `Could not find name from list: ${list}  (called by ${referenceName})`
    );
    return null;
  }

  // This splits the employee name by the comma in the middle and the name after the comma is the first name and the name before is the last name
  // The util function for this does not split the name by the comma, it assumes that the name is just separated by spaces.
  getFirstLastName(
    name: string
  ): null | { firstName: string; lastName: string } {
    if (name.match(/jr.?,/gi)) {
      name = name.replace(/, jr.?,/gi, ",");
    }

    name = _.trim(name, ",");

    if (occurrences(name, ",", false) !== 1) {
      macros.warn("Name has != 1 commas", name);
      return null;
    }

    const splitOnComma = name.split(",");

    const beforeCommaSplit = splitOnComma[1].trim().split(" ");
    const firstName = this.findName(beforeCommaSplit, name);

    const afterCommaSplit = splitOnComma[0].trim().split(" ").reverse();
    const lastName = this.findName(afterCommaSplit, name);

    return { firstName, lastName };
  }

  parseLettersResponse(response, lastNameStart: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.handleRequestResponse(response.body, (err, dom) => {
        const elements = getElementsByTagName("table", dom);
        // console.error(elements);

        for (let i = 0; i < elements.length; i++) {
          const element = elements[i];

          const goal = {
            width: "100%",
          };

          if (_.isEqual(element.attribs, goal)) {
            // Delete one of the elements that is before the header that would mess stuff up
            removeElement(element.children[1].children[1]);

            const tableData: any = this.parseTable(element);

            if (!tableData) {
              return resolve();
            }

            const parsedTable = tableData.parsedTable;
            const rowCount = tableData.rowCount;

            macros.verbose(
              "Found",
              rowCount,
              " people on page ",
              lastNameStart
            );

            for (let j = 0; j < rowCount; j++) {
              const person: Partial<Employee> = {};
              const nameWithComma = he
                .decode(parsedTable.name[j])
                .split("\n\n")[0];

              if (nameWithComma.includes("Do Not Use ")) {
                macros.verbose("Skipping entry that says Do Not Use.");
                continue;
              }

              // Put the first name before the last name.
              // Another way to do this would be to hit the detail section of each employee and scrape the name from the title.
              const commaNameSplit = nameWithComma.split(",");

              for (let k = 0; k < commaNameSplit.length; k++) {
                commaNameSplit[k] = commaNameSplit[k].trim();
              }

              // Remove Jr and Jr.
              _.pull(commaNameSplit, "Jr", "Jr.");

              if (commaNameSplit.length > 2) {
                macros.warn(
                  "Has more than one comma skipping.",
                  commaNameSplit
                );
                person.name = nameWithComma;
              } else {
                person.name = `${commaNameSplit[1].trim()} ${commaNameSplit[0].trim()}`;
              }

              // Generate first name and last name from the name on the person
              const firstLastName = this.getFirstLastName(nameWithComma);
              if (!firstLastName) {
                continue;
              }
              const { firstName, lastName } = firstLastName;
              if (firstName && lastName) {
                person.firstName = firstName;
                person.lastName = lastName;
              }

              // The "#anchor_68409676" tags on the page are randomly generated each time the page is loaded,
              // so use this hrefparameter id instead, which should be more stable.
              // This hrefparameter param is a url encoded, base64 string.
              // We could decode it, but there's just no point.
              const idMatch = parsedTable.name[j].match(
                /.hrefparameter\s+=\s+"id=([\d\w%+/]+)";/i
              );
              if (!idMatch) {
                macros.warn(
                  "Unable to parse id, using random number",
                  nameWithComma
                );
                person.id = String(Math.random());
              } else {
                let id = idMatch[1];

                // Trim the id if it is too long. This is just a sanity check.
                // 35 is just a arbitrary decided number.
                if (id.length > 35) {
                  macros.verbose("person id over 35 chars?", id);
                  id = id.slice(0, 35);
                }

                person.id = id;
              }

              let phone = parsedTable.phone[j];
              phone = phone.replace(/\D/g, "");

              // Maybe add support for guesing area code if it is ommitted and most of the other ones have the same area code
              if (phone.length === 10) {
                person.phone = phone;
              }

              // Scrape the email from the table
              const email = standardizeEmail(parsedTable.email[j]);
              if (email) {
                person.emails = [email];
              }

              // Scrape the primaryappointment
              const primaryappointment = parsedTable.primaryappointment[j];
              if (
                primaryappointment &&
                primaryappointment !== "Not Available"
              ) {
                person.primaryRole = he.decode(
                  parsedTable.primaryappointment[j]
                );
              }

              // Scrape the primary department
              person.primaryDepartment = he.decode(
                parsedTable.primarydepartment[j]
              );

              // Add it to the people list
              this.people.push(person as Employee);
            }
            return resolve();
          }
        }

        macros.error("YOOOOO it didnt find the table", response.body.length);
        macros.error(response.body);
        return reject();
      });
    });
  }

  async get(lastNameStart: string): Promise<Promise<void>> {
    const jsessionCookie = await this.getCookiePromise();

    macros.verbose("neu employee got cookie", jsessionCookie);

    const response = await this.hitWithLetters(lastNameStart, jsessionCookie);

    return this.parseLettersResponse(response, lastNameStart);
  }

  async main(): Promise<Employee[]> {
    // if this is dev and this data is already scraped, just return the data
    if (macros.DEV && require.main !== module) {
      const devData = await cache.get(
        macros.DEV_DATA_DIR,
        this.constructor.name,
        "main"
      );
      if (devData) {
        return devData as Employee[];
      }
    }

    const promises = [];

    const alphabetArray = macros.ALPHABET.split("");

    for (const firstLetter of alphabetArray) {
      for (const secondLetter of alphabetArray) {
        promises.push(this.get(firstLetter + secondLetter));
      }
    }

    await Promise.all(promises);

    macros.verbose("Done all employee requests");

    if (macros.DEV) {
      await cache.set(
        macros.DEV_DATA_DIR,
        this.constructor.name,
        "main",
        this.people
      );
      macros.log(this.people.length, "NEU employees saved.");
    }

    return this.people;
  }
}

const instance = new NeuEmployee();

export default instance;

if (require.main === module) {
  instance.main();
}
