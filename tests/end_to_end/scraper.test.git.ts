import employees from "../../scrapers/employees/employees";

describe("scraping employees", () => {
  it("should be able to query the API and cache it", async () => {
    const result = await employees.main();
    const result2 = await employees.main();

    // The IDs are random for each run, so we remove them.
    result.forEach((res) => delete res.id);
    result2.forEach((res) => delete res.id);

    expect(result2).toEqual(result);
  });
});
