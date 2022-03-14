/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import Request from "../request";
import cache from "../cache";
import macros from "../../utils/macros";
import {
  Employee,
  EmployeeRequestResponse,
  EmployeeWithId,
} from "../../types/types";
import { v4 as uuidv4 } from "uuid";

const request = new Request("Employees");

function employeeQuery(query: string): unknown {
  // These values are taken from the API exposed here: https://nu.outsystemsenterprise.com/FSD/
  // The purpose of these values is unknown, as the API is undocumented. If requests start failing, please
  // inspect the API response at the above link & update accordingly
  return {
    versionInfo: {
      moduleVersion: "mWWAP+YL9U4e9B2D7spGFQ",
      apiVersion: "ad_141F5PYcK3c+D5K8O+g",
    },
    viewName: "MainFlow.FacultyAndStaffDirectory",
    inputParameters: {
      Input_Name1: query,
      Input_Name2: "",
    },
  };
}

// TODO:
// Some of the phone numbers are not 10 digits. Might be able to guess area code, but it is not allways 215 just because some people have offices outside of Boston.

// Currently:
// Name is always scraped. This can vary slightly between different data sources.
// Also, multiple people have the same name so this can not be used as a primary key
// "name": "Hauck, Heather",

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

class NeuEmployee {
  people: EmployeeWithId[];
  couldNotFindNameList: Record<string, boolean>;
  csrfToken: string;

  constructor() {
    this.people = [];
    this.couldNotFindNameList = {};
    this.csrfToken = null;
  }

  async getCsrfToken(): Promise<string> {
    macros.verbose("NEU Employees - getting X-CSRF token");

    return await request
      .get({
        url: "https://nu.outsystemsenterprise.com/FSD/scripts/OutSystems.js",
      })
      .then((resp) => resp.body.match(/"X-CSRFToken".*?="(.*?)"/i)[1]);
  }

  hitWithLetters(lastNameStart: string): Promise<EmployeeRequestResponse[]> {
    return request
      .post({
        url: "https://nu.outsystemsenterprise.com/FSD/screenservices/FSD/MainFlow/Name/ActionGetContactsByName_NonSpecificType",
        body: employeeQuery(lastNameStart),
        json: true,
        headers: {
          "X-CSRFToken": this.csrfToken,
        },
      })
      .then((r) => r.body.data.EmployeeDirectoryContact.List);
  }

  generateEmployeeId(employee: Employee): string {
    let email;
    if (employee.email) {
      email = employee.email;
    } else if (employee.emails && employee.emails.length > 0) {
      email = employee.emails[0];
    }
    return !email || email === "Not Available" ? uuidv4() : email;
  }

  parseLettersResponse(response: EmployeeRequestResponse[]): EmployeeWithId[] {
    this.people = response.map((employee) => {
      const employee_obj = {
        name: `${employee.FirstName} ${employee.LastName}`,
        firstName: employee.FirstName,
        lastName: employee.LastName,
        primaryDepartment: employee.Department,
        primaryRole: employee.PositionTitle,
        phone: employee.PhoneNumber,
        emails: [employee.Email],
        email: employee.Email,
        officeRoom: employee.CampusAddress,
        office: employee.CampusAddress,
      };

      return { ...employee_obj, id: this.generateEmployeeId(employee_obj) };
    });

    return this.people;
  }

  async get(lastNameStart: string): Promise<EmployeeWithId[]> {
    const response = await this.hitWithLetters(lastNameStart);
    return this.parseLettersResponse(response);
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
        return (devData as Employee[]).map((employee) => {
          return { ...employee, id: this.generateEmployeeId(employee) };
        });
      }
    }

    const promises = [];

    const alphabetArray = macros.ALPHABET.split("");

    this.csrfToken = await this.getCsrfToken(); // Cache the CSRF token
    // We have to cache it first, otherwise all the queries try to get it anyways

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
