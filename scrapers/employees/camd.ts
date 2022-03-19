/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import cheerio from "cheerio";

import macros from "../../utils/macros";
import linkSpider from "../linkSpider";
import Request from "../request";
import cache from "../cache";
import {
  parseNameWithSpaces,
  standardizeEmail,
  standardizePhone,
} from "./util";
import { Employee } from "../../types/types";

const request = new Request("Camd");

// Scrapes all the faculty and staff info from camd.northeastern.edu

class Camd {
  // Given a list of elements, this will return the text from all the elements that are text elements
  // Each text will be in its own index in the array.
  getShallowText(elements: cheerio.Element[]): string[] {
    const retVal: string[] = [];
    elements.forEach((element) => {
      if (element.type !== "text") {
        return;
      }

      const text = element.data.trim();
      if (text.length > 0) {
        retVal.push(text);
      }
    });

    return retVal;
  }

  parseDetailPage(url: string, body: string | Buffer): Employee {
    const obj: Partial<Employee> = { url: url };

    const $ = cheerio.load(body);

    // Name of person
    obj.name = $(
      "#main > div.pagecenter > div > div > div > div > div.col10.last.right > h1.entry-title"
    )
      .text()
      .trim()
      .split(",")[0];

    // Parse the first name and the last name from the given name
    const { firstName, lastName } = parseNameWithSpaces(obj.name);

    if (firstName && lastName) {
      obj.firstName = firstName;
      obj.lastName = lastName;
    }

    obj.image = $(
      "#main > div.pagecenter > div > div > div > div > div.col5 > img.wp-post-image"
    ).attr("src");
    if (obj.image) {
      obj.image = obj.image.trim();
    }

    // Primary Role
    // "Associate Professor – Design, Interactive Media"
    let primaryRole = $(
      "#main > div.pagecenter > div > div > div > div > div.col10 > p.introp"
    )
      .text()
      .trim()
      .split(";")[0];
    if (primaryRole.length > 35) {
      // Two different types of dash character
      primaryRole = primaryRole.split(" - ")[0].split(" – ")[0];
    }
    obj.primaryRole = primaryRole;

    // Phone number and office location are just both in a <p> element separated by <br>.
    // Dump all the text and then figure out where the phone and office is.
    const mainElement = $(
      "#main div.pagecenter div.gdcenter div.col16 > div.col5 > p.smallp"
    )[0] as cheerio.TagElement;
    const descriptionElements = mainElement.children;

    let email = $(
      "#main > div.pagecenter > div > div > div > div:nth-child(1) > div.col5 > p > a"
    )
      .text()
      .trim();
    email = standardizeEmail(email);
    if (email) {
      obj.emails = [email];
    }

    const texts = this.getShallowText(descriptionElements);

    texts.forEach((text) => {
      text = text.trim();
      const possiblePhone = standardizePhone(text);
      if (possiblePhone) {
        if (obj.phone) {
          macros.warn("Duplicate phone?", obj.phone, possiblePhone);
        }

        obj.phone = possiblePhone;
      } else if (text.match(/[\w\d-.]+@[\w\d-.]+/) && !obj.emails) {
        // If the email was not hyperlinked, it would not be picked up by the prior email parsing and instead would appear here.
        macros.warn("Parsing plain text as email:", text);
        obj.emails = [text];
      } else if (text.length > 3) {
        // If phone did not match, check office.
        if (text.startsWith("Office: ")) {
          text = text.slice("Office: ".length);
        }

        if (obj.officeRoom) {
          // Only update the office if the new office is longer.
          // This rarely happens, but the longer the string is the more likely it is to be an office location.
          // In all of CAMD, there are only 2 instance where this helps
          if (obj.officeRoom.length < text.length) {
            obj.officeRoom = text;
          }

          return;
        }

        obj.officeRoom = text;
      } else {
        macros.warn("Warn: unknown prop in description", text);
      }
    });

    return obj as Employee;
  }

  async main(): Promise<Employee[]> {
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

    const startingLinks = [
      "https://camd.northeastern.edu/architecture/faculty-staff",
      "https://camd.northeastern.edu/artdesign/faculty-staff",
      "https://camd.northeastern.edu/commstudies/faculty-staff",
      "https://camd.northeastern.edu/gamedesign/faculty-staff",
      "https://camd.northeastern.edu/journalism/faculty-staff",
      "https://camd.northeastern.edu/mscr/faculty-staff",
      "https://camd.northeastern.edu/music/faculty-staff",
      "https://camd.northeastern.edu/theatre/faculty-staff",
    ];

    const urls = await linkSpider.main(startingLinks);

    const profileUrls = [];

    // Filter all the urls found to just profile urls
    // 'https://camd.northeastern.edu/artdesign/people/magy-seif-el-nasr-2/',
    urls.forEach((url) => {
      if (
        url.match(
          /https:\/\/camd.northeastern.edu\/(architecture|artdesign|commstudies|gamedesign|journalism|mscr|music|theatre)\/people\/[\w\d-]+\/?/i
        )
      ) {
        profileUrls.push(url);
      }
    });

    const promises: Promise<Employee>[] = [];

    profileUrls.forEach((url) => {
      promises.push(
        request.get(url).then((response) => {
          return this.parseDetailPage(url, response.body);
        })
      );
    });

    const people = await Promise.all(promises);

    if (macros.DEV) {
      await cache.set(
        macros.DEV_DATA_DIR,
        this.constructor.name,
        "main",
        people
      );
      macros.log(people.length, "CAMD employees saved.");
    }

    return people;
  }
}

const instance = new Camd();

if (require.main === module) {
  instance.main();
}

export default instance;
