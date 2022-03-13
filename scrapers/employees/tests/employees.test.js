/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import employeeData from "./data/employees/employee_results_BE.json";

import employees from "../employees";
import { validate } from "uuid";

// Test to make sure parsing of an employees result page stays the same
it("should be able to parse API responses", async () => {
  employees.parseLettersResponse(employeeData);

  // As documented in the employees.ts file, the decoded string should be 16 bytes.
  // Idk what those bytes mean, but we can check the length
  for (const employee of employees.people) {
    // https://stackoverflow.com/questions/46155/whats-the-best-way-to-validate-an-email-address-in-javascript
    const validId = employee.id.match(/\S+@\S+\.\S+/) || validate(employee.id);
    expect(validId).toBeTruthy();
  }

  expect(employees).toMatchSnapshot();
});
