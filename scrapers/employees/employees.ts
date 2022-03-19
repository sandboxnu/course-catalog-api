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

class NeuEmployee {
  people: EmployeeWithId[];

  constructor() {
    this.people = [];
  }

  parseParameter(parameter: string): string {
    // The NEU API returns 'Not Avaiable' for some fields instead of making them null
    return parameter.toLowerCase() !== "not available" ? parameter : null;
  }

  parseApiResponse(response: EmployeeRequestResponse[]): EmployeeWithId[] {
    return (
      response
        .map((employee) => {
          const email = this.parseParameter(employee.Email);

          return {
            id: email ? email : uuidv4(),
            name: `${employee.FirstName} ${employee.LastName}`,
            firstName: employee.FirstName,
            lastName: employee.LastName,
            primaryDepartment: employee.Department,
            primaryRole: this.parseParameter(employee.PositionTitle),
            phone: this.parseParameter(employee.PhoneNumber),
            emails: email ? [email] : [],
            email: email,
            officeRoom: this.parseParameter(employee.CampusAddress),
          };
        })
        // Northeastern likes testing in prod (don't we all)
        // As of 2022-03, they have 4 employees whose names are variations of "do not use"
        //    Do Not Use, Ed
        //    Do Not Use Hrm See 000499418, Do Not Use
        //    DO NOT USE, DO NOT USE
        .filter(
          (employee) => !employee.name.toLowerCase().includes("do not use")
        )
    );
  }

  /**
   * Queries the Northeastern employees API.
   */
  async queryEmployeesApi(): Promise<void> {
    // These values are taken from the API exposed here: https://nu.outsystemsenterprise.com/FSD/
    // The purpose of these values is unknown, as the API is undocumented. If requests start failing, please
    // inspect the API response at the above link & update accordingly

    // Scrapes the source code to get the X-CSRF token.
    const csrfToken = await request
      .get({
        url: "https://nu.outsystemsenterprise.com/FSD/scripts/OutSystems.js",
      })
      .then((resp) => {
        console.log(resp);
        return resp.body.match(/"X-CSRFToken".*?="(.*?)"/i)[1];
      });

    const moduleVersion = await request
      .get({
        url: "https://nu.outsystemsenterprise.com/FSD/moduleservices/moduleversioninfo",
      })
      .then((resp) => resp.body["versionToken"]);

    const employeeQuery = {
      versionInfo: {
        moduleVersion,
        apiVersion: "ad_141F5PYcK3c+D5K8O+g",
      },
      viewName: "MainFlow.FacultyAndStaffDirectory",
      // Their frontend requires non-null queries, but the backend doesn't :)
      inputParameters: {
        Input_Name1: "",
        Input_Name2: "",
      },
    };

    const response: EmployeeRequestResponse[] = await request
      .post({
        url: "https://nu.outsystemsenterprise.com/FSD/screenservices/FSD/MainFlow/Name/ActionGetContactsByName_NonSpecificType",
        body: employeeQuery,
        json: true,
        headers: {
          "X-CSRFToken": csrfToken,
        },
      })
      .then((r) => r.body.data.EmployeeDirectoryContact.List);

    this.people = this.parseApiResponse(response);
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
          const id = employee?.email ?? uuidv4();
          return { ...employee, id };
        });
      }
    }

    await this.queryEmployeesApi();

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
