import employees from "../../scrapers/employees/employees";

describe("scraping employees", () => {
  it("should be able to query the API", async () => {
    await employees.queryEmployeesApi();

    // There should be at least one employee (hopefully)
    expect(employees.people.length).toBeGreaterThan(0);

    for (const employee of employees.people) {
      expect(employee.name).toBeTruthy();
      expect(employee.firstName).toBeTruthy();
      expect(employee.lastName).toBeTruthy();
    }
  });
});
