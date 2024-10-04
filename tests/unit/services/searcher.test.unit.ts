import searcher from "../../../services/searcher";
import { LeafQuery, ParsedQuery } from "../../../types/searchTypes";

beforeAll(async () => {
  searcher.subjects = {};
});

describe("searcher unit tests", () => {
  //Unit tests for the parseQuery function
  describe("parseQuery", () => {
    it("query with no phrases", () => {
      const retQueries: ParsedQuery = searcher.parseQuery(
        "this is a query with no phrases"
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
