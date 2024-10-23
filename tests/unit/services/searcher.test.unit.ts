import searcher from "../../../services/searcher";
import { LeafQuery, ParsedQuery } from "../../../types/searchTypes";

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

describe("searcher unit tests", () => {
  beforeAll(async () => {
    searcher.subjects = {};
  });

  //Unit tests for the parseQuery function
  describe("parseQuery", () => {
    it("query with no phrases", () => {
      const retQueries: ParsedQuery = searcher.parseQuery(
        "this is a query with no phrases",
      );
      expect(retQueries.phraseQ.length).toEqual(0); //no phrase queries
      expect(retQueries.fieldQ).not.toEqual(null);
      const fieldQuery: LeafQuery = retQueries.fieldQ;

      expect(fieldQuery).toEqual({
        multi_match: {
          query: "this is a query with no phrases",
          type: "most_fields",
          fields: searcher.getFields(),
        },
      });
    });

    it("query with just a phrase", () => {
      const retQueries: ParsedQuery = searcher.parseQuery('"this is a phrase"');

      expect(retQueries.phraseQ.length).toEqual(1);
      expect(retQueries.fieldQ).toEqual(null);

      const phraseQuery: LeafQuery = retQueries.phraseQ[0];

      expect(phraseQuery).toEqual({
        multi_match: {
          query: "this is a phrase",
          type: "phrase",
          fields: searcher.getFields(),
        },
      });
    });

    it("query with a phrase and other text", () => {
      const retQueries: ParsedQuery = searcher.parseQuery('text "phrase" text');
      expect(retQueries.phraseQ.length).toEqual(1);
      expect(retQueries.fieldQ).not.toEqual(null);

      const phraseQuery: LeafQuery = retQueries.phraseQ[0];
      const fieldQuery: LeafQuery = retQueries.fieldQ;

      expect(phraseQuery).toEqual({
        multi_match: {
          query: "phrase",
          type: "phrase",
          fields: searcher.getFields(),
        },
      });

      expect(fieldQuery).toEqual({
        multi_match: {
          query: "text text",
          type: "most_fields",
          fields: searcher.getFields(),
        },
      });
    });
  });
});
