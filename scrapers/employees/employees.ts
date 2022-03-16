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

const EMPLOYEE_QUERY = {
  // These values are taken from the API exposed here: https://nu.outsystemsenterprise.com/FSD/
  // The purpose of these values is unknown, as the API is undocumented. If requests start failing, please
  // inspect the API response at the above link & update accordingly
  versionInfo: {
    moduleVersion: "mWWAP+YL9U4e9B2D7spGFQ",
    apiVersion: "ad_141F5PYcK3c+D5K8O+g",
  },
  viewName: "MainFlow.FacultyAndStaffDirectory",
  // Their frontend requires non-null queries, but the backend doesn't :)
  inputParameters: {
    Input_Name1: "",
    Input_Name2: "",
  },
};

class NeuEmployee {
  people: EmployeeWithId[];

  constructor() {
    this.people = [];
  }

  // Scrapes the page to get the X-CSRF token. This may change - to update, simply visit the page and inspect the request headers
  // using your browser developer tools
  async getCsrfToken(): Promise<string> {
    macros.verbose("NEU Employees - getting X-CSRF token");

    return await request
      .get({
        url: "https://nu.outsystemsenterprise.com/FSD/scripts/OutSystems.js",
      })
      .then((resp) => resp.body.match(/"X-CSRFToken".*?="(.*?)"/i)[1]);
  }

  generateEmployeeId(email?: string): string {
    if (email && email !== "Not Available") {
      return email;
    }
    return uuidv4();
  }

  parseApiResponse(response: EmployeeRequestResponse[]): EmployeeWithId[] {
    return response.map((employee) => {
      return {
        id: this.generateEmployeeId(employee.Email),
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
    });
  }

  async queryEmployeesApi(): Promise<void> {
    const csrfToken = await this.getCsrfToken();
    const response: EmployeeRequestResponse[] = await request
      .post({
        url: "https://nu.outsystemsenterprise.com/FSD/screenservices/FSD/MainFlow/Name/ActionGetContactsByName_NonSpecificType",
        body: EMPLOYEE_QUERY,
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
          return { ...employee, id: this.generateEmployeeId(employee?.email) };
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
