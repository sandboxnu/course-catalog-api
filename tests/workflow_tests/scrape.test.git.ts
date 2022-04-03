import employees from "../../scrapers/employees/employees";

describe("scraping employees", () => {
  it("should be able to query the API", async () => {
    await employees.queryEmployeesApi();

    console.log(employees.people.length);
    expect(employees.people.length).toBeGreaterThan(1_000);

    for (const employee of employees.people) {
      // Ensure that the fields we expect to be required actually are
      expect(employee.name).toBeTruthy();
      expect(employee.firstName).toBeTruthy();
      expect(employee.lastName).toBeTruthy();
    }
  });
});
