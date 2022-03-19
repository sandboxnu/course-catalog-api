/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import employeeData from "./data/employees/employee_results_BE.json";

import employees from "../employees";
import { validate } from "uuid";

describe("static data", () => {
  // Test to make sure parsing of an employees result page stays the same
  it("should be able to parse API responses", async () => {
    const employeeList = employees.parseApiResponse(employeeData);

    for (const employee of employeeList) {
      // https://stackoverflow.com/questions/46155/whats-the-best-way-to-validate-an-email-address-in-javascript
      const validId =
        employee.id.match(/\S+@\S+\.\S+/) || validate(employee.id);
      expect(validId).toBeTruthy();
      expect(employee.name.toLowerCase().includes("do not use")).toBeFalsy();

      // The employees API returns 'Not Avaiable' for some fields instead of making them null
      // This makes sure we filter them all out
      const matchesNotAvailable = (obj: any): boolean =>
        JSON.stringify(obj).match(/Not Available/);

      expect(matchesNotAvailable({ key: "Not Available" })).toBeTruthy(); // Sanity-check the regex
      expect(matchesNotAvailable(employee)).toBeFalsy();
    }

    expect(employeeList).toMatchSnapshot();
  });
});
