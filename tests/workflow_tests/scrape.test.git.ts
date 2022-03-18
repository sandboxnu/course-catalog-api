import employees from "../../scrapers/employees/employees";

describe("scraping employees", () => {
  it("should be able to query the API", async () => {
    await employees.queryEmployeesApi();

    // It's a safe bet that there are at least 1000 employees
    expect(employees.people.length).toBeGreaterThan(1_000);

    for (const employee of employees.people) {
      // Ensure that the fields we expect to be required actually are
      expect(employee.name).toBeTruthy();
      expect(employee.firstName).toBeTruthy();
      expect(employee.lastName).toBeTruthy();
    }
  });
});
