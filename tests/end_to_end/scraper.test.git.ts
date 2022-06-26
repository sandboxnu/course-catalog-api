import employees from "../../scrapers/employees/employees";

describe("scraping employees", () => {
  it("should be able to query the API and cache it", async () => {
    jest.spyOn(employees, "queryEmployeesApi");
    const result = await employees.main();

    expect(await employees.main()).toEqual(result);

    // The second time should use the cache
    expect(employees.queryEmployeesApi).toHaveBeenCalledTimes(1);
  });
});
