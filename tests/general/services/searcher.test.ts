import searcher from "../../../services/searcher";

function validateValues(
  filterKey: string,
  validValues: any[],
  invalidValues: any[],
): void {
  for (const value of validValues) {
    expect(searcher.filters[filterKey].validate(value)).toBeTruthy();
  }

  for (const value of invalidValues) {
    expect(searcher.filters[filterKey].validate(value)).toBeFalsy();
  }
}

describe("filters", () => {
  it("NUPath validations work", () => {
    const validValues = [["WI"], ["WI", "CE"], []];
    const invalidValues = [3, false, {}, "string"];
    validateValues("nupath", validValues, invalidValues);
  });

  it("subject validations work", () => {
    const validValues = [["CS"], ["ENGW", "CE"], []];
    const invalidValues = [3, false, {}, "string"];
    validateValues("subject", validValues, invalidValues);
  });

  it("classType validations work", () => {
    const validValues = [["lecture"], ["lecture", "CE"], []];
    const invalidValues = [3, false, {}, "string"];
    validateValues("classType", validValues, invalidValues);
  });

  it("sectionsAvailable validations work", () => {
    const validValues = [true];
    const invalidValues = [3, false, {}, "string"];
    validateValues("sectionsAvailable", validValues, invalidValues);
  });

  it("classIdRange validations work", () => {
    const validValues = [{ min: 3, max: 4 }];
    const invalidValues = [
      3,
      false,
      {},
      "string",
      { min: 3 },
      { min: 3, max: "String" },
    ];
    validateValues("classIdRange", validValues, invalidValues);
  });

  it("termId validations work", () => {
    const validValues = ["12345"];
    const invalidValues = [3, false, {}, ["string"], { min: 3 }];
    validateValues("termId", validValues, invalidValues);
  });

  it("campus validations work", () => {
    const validValues = [["BOSTON"], ["BOSTON", "BOSNIA"], []];
    const invalidValues = [3, false, {}, "string"];
    validateValues("campus", validValues, invalidValues);
  });

  it("honors validations work", () => {
    const validValues = [true, false];
    const invalidValues = [3, {}, [], "true", "string"];
    validateValues("honors", validValues, invalidValues);
  });
});
