import searcher from "../../services/searcher";
import prisma from "../../services/prisma";
import { LeafQuery, ParsedQuery } from "../../types/searchTypes";

beforeAll(async () => {
  searcher.subjects = {};
});

describe("searcher", () => {
  describe("generateMQuery", () => {
    it("generates with no filters", () => {
      expect(
        searcher.generateMQuery("fundies", "202030", 0, 10, {})
      ).toMatchSnapshot();
    });

    it("generates aggs with campus filters applied", () => {
      expect(
        searcher.generateMQuery("fundies", "202030", 0, 10, {
          campus: ["Online", "Boston"],
        })
      ).toMatchSnapshot();
    });
  });

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
  // TODO: create an association between cols in elasticCourseSerializer and here
  describe("generateQuery", () => {
    it("generates match_all when no query", () => {
      expect(
        searcher.generateQuery("", "202030", {}, 0, 10).query["bool"]["must"]
      ).toEqual({ match_all: {} });
    });

    it("generates a query without filters", () => {
      expect(
        searcher.generateQuery("fundies", "202030", {}, 0, 10, "nupath")
      ).toMatchSnapshot();
    });
  });

  describe("validateFilters", () => {
    it("removes invalid filters", () => {
      const invalidFilters = {
        NUpath: "NU Core/NUpath Adv Writ Dscpl",
        college: "GS Col of Arts",
        subject: "CS",
        online: false,
        campus: ["Boston"],
        classType: ["Lecture"],
        inValidFilterKey: "",
      };
      expect(searcher.validateFilters(invalidFilters)).toMatchObject({});
    });

    it("keeps all valid filters", () => {
      const validFilters = {
        nupath: [
          "NU Core/NUpath Adv Writ Dscpl",
          "NUpath Interpreting Culture",
        ],
        subject: ["ENGW", "ARTG", "CS"],
        campus: ["Boston"],
        classType: ["Lecture"],
      };
      expect(searcher.validateFilters(validFilters)).toMatchObject(
        validFilters
      );
    });
  });

  describe("Single search result", () => {
    beforeEach(async () => {
      await prisma.section.deleteMany({});
      await prisma.course.deleteMany({});
      await prisma.course.create({
        data: {
          id: "neu.edu/202030/CS/2500",
          host: "neu.edu",
          classId: "2500",
          name: "Fundamentals of Computer Science 1",
          termId: "202030",
          subject: "CS",
          lastUpdateTime: new Date(),
        },
      });
      await prisma.course.create({
        data: {
          id: "neu.edu/202030/PHIL/1145",
          host: "neu.edu",
          classId: "1145",
          name: "Tech and Human Values",
          termId: "202030",
          subject: "PHIL",
          nupath: { set: ["Ethical reasoning", "Argue", "Live in the mud"] },
        },
      });
      await prisma.course.create({
        data: {
          id: "neu.edu/202030/CS/2510",
          host: "neu.edu",
          classId: "2510",
          name: "Fundamentals of Computer Science 2",
          termId: "202030",
          subject: "CS",
        },
      });
      await prisma.section.create({
        data: {
          id: "neu.edu/202030/CS/2500/19350",
          course: { connect: { id: "neu.edu/202030/CS/2500" } },
          seatsCapacity: 80,
          seatsRemaining: 0,
          classType: "Lecture",
          campus: "Seattle, WA",
          honors: false,
        },
      });
      await prisma.section.create({
        data: {
          id: "neu.edu/202030/PHIL/1145/20142",
          course: { connect: { id: "neu.edu/202030/PHIL/1145" } },
          seatsCapacity: 40,
          seatsRemaining: 0,
          classType: "Lecture",
          campus: "Boston",
          honors: true,
        },
      });
    });
    describe("getSingleResultAggs", () => {
      it("Gets aggregation for single result", async () => {
        const singleResult = await prisma.course.findUnique({
          where: { id: "neu.edu/202030/CS/2500" },
          include: { sections: true },
        });
        expect(searcher.getSingleResultAggs(singleResult)).toEqual({
          campus: [{ value: "Seattle, WA", count: 1 }],
          nupath: [],
          subject: [{ value: "CS", count: 1 }],
          classType: [{ value: "Lecture", count: 1 }],
          honors: [{ value: "false", count: 1 }],
        });
      });
      it("Gets aggregation for single result with nupath", async () => {
        const singleResult = await prisma.course.findUnique({
          where: { id: "neu.edu/202030/PHIL/1145" },
          include: { sections: true },
        });
        expect(searcher.getSingleResultAggs(singleResult)).toEqual({
          campus: [{ value: "Boston", count: 1 }],
          nupath: [
            { value: "Ethical reasoning", count: 1 },
            { value: "Argue", count: 1 },
            { value: "Live in the mud", count: 1 },
          ],
          subject: [{ value: "PHIL", count: 1 }],
          classType: [{ value: "Lecture", count: 1 }],
          honors: [{ value: "true", count: 1 }],
        });
      });
    });
    describe("getOneSearchResult", () => {
      it("Gets results for valid class", async () => {
        expect(
          await searcher.getOneSearchResult("CS", "2500", "202030")
        ).toMatchObject({
          results: [
            {
              class: {
                id: "neu.edu/202030/CS/2500",
                host: "neu.edu",
                classId: "2500",
                name: "Fundamentals of Computer Science 1",
                termId: "202030",
                subject: "CS",
                lastUpdateTime: expect.anything(),
              },
            },
          ],
          resultCount: 1,
          took: 0,
          hydrateDuration: expect.anything(),
          aggregations: {
            nupath: [],
            subject: [{ count: 1, value: "CS" }],
            classType: [{ count: 1, value: "Lecture" }],
          },
        });
      });
      it("Gets 0 results for invalid course", async () => {
        expect(
          await searcher.getOneSearchResult("CS", "2504", "202030")
        ).toMatchObject({
          results: [],
          resultCount: 0,
          took: 0,
          hydrateDuration: expect.anything(),
          aggregations: {
            nupath: [],
            subject: [],
            classType: [],
          },
        });
      });
      it("Gets 0 results for course with no sections", async () => {
        expect(
          await searcher.getOneSearchResult("CS", "2510", "202030")
        ).toMatchObject({
          results: [],
          resultCount: 0,
          took: 0,
          hydrateDuration: expect.anything(),
          aggregations: {
            nupath: [],
            subject: [],
            classType: [],
          },
        });
      });
    });
  });
});
