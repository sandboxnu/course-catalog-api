import { suite, test, before, type TestContext } from "node:test";

import searcher from "../../services/searcher";
import { LeafQuery, ParsedQuery } from "$/types/searchTypes";

function validateValues(
  t: TestContext,
  filterKey: string,
  validValues: any[],
  invalidValues: any[],
): void {
  for (const value of validValues) {
    t.assert.ok(searcher.filters[filterKey].validate(value));
  }

  for (const value of invalidValues) {
    t.assert.ok(!searcher.filters[filterKey].validate(value));
  }
}

suite("filters", () => {
  test("NUPath validations work", (t) => {
    const validValues = [["WI"], ["WI", "CE"], []];
    const invalidValues = [3, false, {}, "string"];
    validateValues(t, "nupath", validValues, invalidValues);
  });

  test("subject validations work", (t) => {
    const validValues = [["CS"], ["ENGW", "CE"], []];
    const invalidValues = [3, false, {}, "string"];
    validateValues(t, "subject", validValues, invalidValues);
  });

  test("classType validations work", (t) => {
    const validValues = [["lecture"], ["lecture", "CE"], []];
    const invalidValues = [3, false, {}, "string"];
    validateValues(t, "classType", validValues, invalidValues);
  });

  test("sectionsAvailable validations work", (t) => {
    const validValues = [true];
    const invalidValues = [3, false, {}, "string"];
    validateValues(t, "sectionsAvailable", validValues, invalidValues);
  });

  test("classIdRange validations work", (t) => {
    const validValues = [{ min: 3, max: 4 }];
    const invalidValues = [
      3,
      false,
      {},
      "string",
      { min: 3 },
      { min: 3, max: "String" },
    ];
    validateValues(t, "classIdRange", validValues, invalidValues);
  });

  test("termId validations work", (t) => {
    const validValues = ["12345"];
    const invalidValues = [3, false, {}, ["string"], { min: 3 }];
    validateValues(t, "termId", validValues, invalidValues);
  });

  test("campus validations work", (t) => {
    const validValues = [["BOSTON"], ["BOSTON", "BOSNIA"], []];
    const invalidValues = [3, false, {}, "string"];
    validateValues(t, "campus", validValues, invalidValues);
  });

  test("honors validations work", (t) => {
    const validValues = [true, false];
    const invalidValues = [3, {}, [], "true", "string"];
    validateValues(t, "honors", validValues, invalidValues);
  });
});

suite("searcher unit tests", () => {
  before(async () => {
    searcher.subjects = {};
  });

  //Unit tests for the parseQuery function
  suite("parseQuery", () => {
    test("query with no phrases", (t) => {
      const retQueries: ParsedQuery = searcher.parseQuery(
        "this is a query with no phrases",
      );
      t.assert.equal(retQueries.phraseQ.length, 0);
      t.assert.notEqual(retQueries.fieldQ, null);

      const fieldQuery: LeafQuery = retQueries.fieldQ;
      t.assert.deepEqual(fieldQuery, {
        multi_match: {
          query: "this is a query with no phrases",
          type: "most_fields",
          fields: searcher.getFields(),
        },
      });
    });

    test("query with just a phrase", (t) => {
      const retQueries: ParsedQuery = searcher.parseQuery('"this is a phrase"');
      t.assert.equal(retQueries.phraseQ.length, 1);
      t.assert.equal(retQueries.fieldQ, null);

      const phraseQuery: LeafQuery = retQueries.phraseQ[0];
      t.assert.deepEqual(phraseQuery, {
        multi_match: {
          query: "this is a phrase",
          type: "phrase",
          fields: searcher.getFields(),
        },
      });
    });

    test("query with a phrase and other text", (t) => {
      const retQueries: ParsedQuery = searcher.parseQuery('text "phrase" text');
      t.assert.equal(retQueries.phraseQ.length, 1);
      t.assert.notEqual(retQueries.fieldQ, null);

      const phraseQuery: LeafQuery = retQueries.phraseQ[0];
      const fieldQuery: LeafQuery = retQueries.fieldQ;

      t.assert.deepEqual(phraseQuery, {
        multi_match: {
          query: "phrase",
          type: "phrase",
          fields: searcher.getFields(),
        },
      });

      t.assert.deepEqual(fieldQuery, {
        multi_match: {
          query: "text text",
          type: "most_fields",
          fields: searcher.getFields(),
        },
      });
    });
  });
});
