import employees from "../../scrapers/employees/employees";

describe("scraping employees", () => {
  it("should be able to query the API", async () => {
    await employees.queryEmployeesApi();

    expect(employees.people.length).toBe(7652);

    for (const employee of employees.people) {
      // Ensure that the fields we expect to be required actually are
      expect(employee.name).toBeTruthy();
      expect(employee.firstName).toBeTruthy();
      expect(employee.lastName).toBeTruthy();
    }
  });
});
