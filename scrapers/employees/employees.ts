/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import Request from "../request.js";
import cache from "../cache.js";
import macros from "../../utils/macros.js";
import { Employee, EmployeeRequestResponse } from "../../types/types.js";
import { v4 as uuidv4 } from "uuid";

const request = new Request("Employees");

class NeuEmployee {
  people: Employee[];

  constructor() {
    this.people = [];
  }

  /**
   * The NEU API returns 'Not Available' for some fields instead of making them null.
   * Given an optional string, return null if the string is undefined or 'Not Available'
   */
  private parseOptionalParameter(parameter?: string): string | null {
    if (!parameter || parameter.toLocaleLowerCase() === "not available") {
      return null;
    }
    return parameter;
  }

  /**
   * Given the raw data for one employee from NEU's API, convert it to our
   * expected Employee type.
   */
  private parseEmployee(employee: EmployeeRequestResponse): Employee {
    const email = this.parseOptionalParameter(employee.Email);
    const primaryRole = this.parseOptionalParameter(employee.PositionTitle);
    const longPrimaryRole = this.parseOptionalParameter(
      employee.LongPositionTitle
    );

    return {
      id: email ?? uuidv4(),
      name: `${employee.FirstName} ${employee.LastName}`,
      firstName: employee.FirstName,
      lastName: employee.LastName,
      primaryDepartment: employee.Department,
      primaryRole: primaryRole ?? longPrimaryRole,
      phone: this.parseOptionalParameter(employee.PhoneNumber),
      email: email,
      officeRoom: this.parseOptionalParameter(employee.CampusAddress),
    };
  }

  parseApiResponse(response: EmployeeRequestResponse[]): Employee[] {
    return (
      response
        .map((employee) => this.parseEmployee(employee))
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

  // Scrapes the source code to get the X-CSRF token.
  async queryXcsrfToken(): Promise<string> {
    return request
      .get("https://nu.outsystemsenterprise.com/FSD/scripts/OutSystems.js")
      .then((resp) => {
        return resp.body.match(/"X-CSRFToken".*?="(.*?)"/i)[1];
      });
  }

  // Queries the API module version from the API (needed for requests)
  async queryModuleVersion(): Promise<string> {
    return request
      .get(
        "https://nu.outsystemsenterprise.com/FSD/moduleservices/moduleversioninfo"
      )
      .then((resp) => resp.body["versionToken"]);
  }

  /**
   * Queries the Northeastern employees API.
   */
  async queryEmployeesApi(): Promise<void> {
    // These values are taken from the API exposed here: https://nu.outsystemsenterprise.com/FSD/
    // The purpose of these values is unknown, as the API is undocumented. If requests start failing, please
    // inspect the API response at the above link & update accordingly
    const csrfToken = await this.queryXcsrfToken();
    const moduleVersion = await this.queryModuleVersion();

    const employeeQuery = {
      versionInfo: {
        moduleVersion,
        apiVersion: "ad_141F5PYcK3c+D5K8O+g",
      },
      viewName: "MainFlow.FacultyAndStaffDirectory",
      // Their frontend requires non-null queries, but the backend doesn't :)
      // If this changes at any point, we used to do a cartesian product of the alphabet
      // ('aa', 'ab', etc.). See https://github.com/sandboxnu/course-catalog-api/pull/97/files for more
      inputParameters: {
        Input_Name1: "",
        Input_Name2: "",
      },
    };

    const response: EmployeeRequestResponse[] = await request
      .post(
        "https://nu.outsystemsenterprise.com/FSD/screenservices/FSD/MainFlow/Name/ActionGetContactsByName_NonSpecificType",
        {
          body: employeeQuery,
          json: true,
          headers: {
            "X-CSRFToken": csrfToken,
          },
        }
      )
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
