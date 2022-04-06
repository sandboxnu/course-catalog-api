/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import employeeData from "./data/employees/employee_results_BE.json";

import employees from "../employees";
import { validate } from "uuid";

// This should not be top-level, but we needed a workaround.
// https://github.com/facebook/jest/issues/11543
jest.unmock("request-promise-native");
jest.setTimeout(20_000);

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
        /Not Available/.test(JSON.stringify(obj));

      expect(matchesNotAvailable({ key: "Not Available" })).toBeTruthy(); // Sanity-check the regex
      expect(matchesNotAvailable(employee)).toBeFalsy();
    }

    expect(employeeList).toMatchSnapshot();
  });
});

describe("scraping employees", () => {
  it("should be able to query the API", async () => {
    await employees.queryEmployeesApi();

    // Don't use a precise number - this hits the live API, so we don't know how many there are
    expect(employees.people.length).toBeGreaterThan(1_000);

    for (const employee of employees.people) {
      // Ensure that the fields we expect to be required actually are
      expect(employee.name).toBeTruthy();
      expect(employee.firstName).toBeTruthy();
      expect(employee.lastName).toBeTruthy();
    }
  });
});
