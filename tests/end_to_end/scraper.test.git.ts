import employees from "../../scrapers/employees/employees";

describe("scraping employees", () => {
  it("should be able to query the API and cache it", async () => {
    jest.spyOn(employees, "queryEmployeesApi");
    const result = await employees.main();
    const result2 = await employees.main();

    // The IDs are random for each run, so we remove them.
    result.forEach((res) => delete res.id);
    result2.forEach((res) => delete res.id);

    expect(result2).toEqual(result);

    // The second time should use the cache
    expect(employees.queryEmployeesApi).toHaveBeenCalledTimes(1);
  });
});
