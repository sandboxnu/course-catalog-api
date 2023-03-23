/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import _ from "lodash";
import { Course, Section } from "../types/types";
import {
  Course as PrismaCourse,
  Section as PrismaSection,
} from "@prisma/client";
import prisma from "../services/prisma";
import elastic, { Elastic } from "../utils/elastic";
import HydrateSerializer from "../serializers/hydrateSerializer";
import HydrateCourseSerializer from "../serializers/hydrateCourseSerializer";
import macros from "../utils/macros";
import {
  EsQuery,
  QueryNode,
  ExistsQuery,
  TermsQuery,
  TermQuery,
  LeafQuery,
  MATCH_ALL_QUERY,
  RangeQuery,
  EsFilterStruct,
  EsAggFilterStruct,
  FilterInput,
  FilterPrelude,
  AggFilterPrelude,
  SortInfo,
  Range,
  SearchResults,
  SingleSearchResult,
  PartialResults,
  AggCount,
  EsResultBody,
  EsMultiResult,
  AggResults,
  SearchResult,
  ParsedQuery,
  EsValue,
} from "../types/searchTypes";
import { SerializedCourse } from "../types/serializerTypes";

type CourseWithSections = PrismaCourse & { sections: PrismaSection[] };

class Searcher {
  elastic: Elastic;

  subjects: Record<string, string>;

  filters: FilterPrelude;

  aggFilters: AggFilterPrelude;

  AGG_RES_SIZE: number;

  /**
   * Regex for matching a course-code (eg. "CS3500")
   */
  COURSE_CODE_PATTERN: RegExp;

  constructor() {
    this.elastic = elastic;
    this.subjects = {};
    this.filters = Searcher.generateFilters();
    this.aggFilters = _.pickBy<EsFilterStruct, EsAggFilterStruct>(
      this.filters,
      (f): f is EsAggFilterStruct => f.agg !== false
    );
    this.AGG_RES_SIZE = 1000;
    this.COURSE_CODE_PATTERN = /^\s*([a-zA-Z]{2,4})\s*(\d{4})?\s*$/i;
  }

  static generateFilters(): FilterPrelude {
    // type validating functions
    const isString = (arg: unknown): arg is string => {
      return typeof arg === "string";
    };

    const isBoolean = (arg: unknown): arg is boolean => {
      return typeof arg === "boolean";
    };

    const isStringArray = (arg: unknown): arg is string[] => {
      return Array.isArray(arg) && arg.every((elem) => isString(elem));
    };

    const isTrue = (arg: unknown): arg is true => {
      return typeof arg === "boolean" && arg;
    };

    const isNum = (arg: unknown): arg is number => {
      return typeof arg === "number";
    };

    const isRange = (arg: any): arg is Range => {
      return (
        _.difference(Object.keys(arg), ["min", "max"]).length === 0 &&
        isNum(arg.min) &&
        isNum(arg.max)
      );
    };

    // filter-generating functions
    const getSectionsAvailableFilter = (): ExistsQuery => {
      return { exists: { field: "sections" } };
    };

    const getNUpathFilter = (selectedNUpaths: string[]): TermsQuery => {
      return { terms: { "class.nupath.keyword": selectedNUpaths } };
    };

    const getSubjectFilter = (selectedSubjects: string[]): TermsQuery => {
      return { terms: { "class.subject.keyword": selectedSubjects } };
    };

    const getClassTypeFilter = (selectedClassTypes: string[]): TermsQuery => {
      return { terms: { "sections.classType.keyword": selectedClassTypes } };
    };

    const getTermIdFilter = (selectedTermId: string): TermQuery => {
      return { term: { "class.termId": selectedTermId } };
    };

    const getRangeFilter = (selectedRange: Range): RangeQuery => {
      return {
        range: {
          "class.classId.numeric": {
            gte: selectedRange.min,
            lte: selectedRange.max,
          },
        },
      };
    };

    const getCampusFilter = (selectedCampuses: string[]): TermsQuery => {
      return { terms: { "sections.campus.keyword": selectedCampuses } };
    };

    const getHonorsFilter = (selectedHonors: boolean): TermQuery => {
      return { term: { "sections.honors": selectedHonors } };
    };

    return {
      nupath: {
        validate: isStringArray,
        create: getNUpathFilter,
        agg: "class.nupath.keyword",
      } as EsFilterStruct<string[]>,
      subject: {
        validate: isStringArray,
        create: getSubjectFilter,
        agg: "class.subject.keyword",
      } as EsFilterStruct<string[]>,
      classType: {
        validate: isStringArray,
        create: getClassTypeFilter,
        agg: "sections.classType.keyword",
      } as EsFilterStruct<string[]>,
      sectionsAvailable: {
        validate: isTrue,
        create: getSectionsAvailableFilter,
        agg: false,
      } as EsFilterStruct<true>,
      classIdRange: {
        validate: isRange,
        create: getRangeFilter,
        agg: false,
      } as EsFilterStruct<Range>,
      termId: {
        validate: isString,
        create: getTermIdFilter,
        agg: false,
      } as EsFilterStruct<string>,
      campus: {
        validate: isStringArray,
        create: getCampusFilter,
        agg: "sections.campus.keyword",
      } as EsFilterStruct<string[]>,
      honors: {
        validate: isBoolean,
        create: getHonorsFilter,
        agg: "sections.honors",
      } as EsFilterStruct<boolean>,
    };
  }

  async initializeSubjects(): Promise<void> {
    if (_.isEmpty(this.subjects)) {
      (await prisma.subject.findMany()).forEach((obj) => {
        this.subjects[obj.abbreviation] = obj.description;
      });
    }
  }

  /**
   * Remove any invalid filter with the following criteria:
   * 1. Correct key string and value type;
   * 2. Check that { online: false } should never be in filters
   *
   * A sample filters JSON object has the following format:
   * { 'nupath': string[],
   *   'college': string[],
   *   'subject': string[],
   *   'classType': string }
   *
   * @param {object} filters The json object represting all filters on classes
   */
  validateFilters(filters: FilterInput): FilterInput {
    const validFilters: FilterInput = {};
    Object.keys(filters).forEach((currFilter) => {
      if (!(currFilter in this.filters)) {
        macros.warn("Invalid filter key.", currFilter);
      } else if (!this.filters[currFilter].validate(filters[currFilter])) {
        macros.warn("Invalid filter value type.", currFilter);
      } else {
        validFilters[currFilter] = filters[currFilter];
      }
    });
    return validFilters;
  }

  getFields(): string[] {
    return [
      "class.name^2", // Boost by 2
      "class.name.autocomplete",
      "class.subject^4",
      "class.classId^3",
      "sections.profs",
      "sections.crn",
      "employee.name^2",
      "employee.email",
      "employee.phone",
    ];
  }

  /**
   * Given a string, creates a list of queries that are either phrase queries or
   * most_field queries. Phrases are between quotes, and use phrase matching.
   * Most_field queries are everything else, and search the terms on all fields.
   * @param query the string that is parsed into a list
   * @returns an object containing a list of phrase_queries, and a field query.
   */
  parseQuery(query: string): ParsedQuery {
    const matches = [...query.matchAll(/"(.*?)"/gi)];
    const matchedPhrases = matches.map((match) => {
      return match[0];
    });

    const matchesRegExp = new RegExp(matchedPhrases.join("|"), "gi");

    //make sure theres no extra white space after removing the phrases.
    const nonMatches = query
      .replace(matchesRegExp, "")
      .replace('"', "")
      .replace(/\s+/g, " ")
      .trim();

    // go through the phrases, and make phrase queries with them.
    const phraseQueries = matches.map((match) => {
      return {
        multi_match: {
          query: match[1],
          type: "phrase",
          fields: this.getFields(),
        },
      };
    });

    //make the field query and add it to the list.
    let fieldQuery: LeafQuery = null;
    if (nonMatches.trim() !== "") {
      fieldQuery = {
        multi_match: {
          query: nonMatches,
          type: "most_fields",
          fields: this.getFields(),
        },
      };
    }

    return {
      phraseQ: phraseQueries,
      fieldQ: fieldQuery,
    };
  }

  /**
   * Get elasticsearch query
   */
  generateQuery(
    query: string,
    termId: string,
    userFilters: FilterInput,
    min: number,
    max: number,
    aggregation = ""
  ): EsQuery {
    //a list of all queries
    const matchQueries: ParsedQuery = this.parseQuery(query);

    const phraseQueries: LeafQuery[] = matchQueries.phraseQ;

    const fieldQuery: LeafQuery = matchQueries.fieldQ;
    const fieldQueryExists = fieldQuery !== null;

    // use lower classId has tiebreaker after relevance
    const sortByClassId: SortInfo = {
      "class.classId.keyword": { order: "asc", unmapped_type: "keyword" },
    };

    // filter by type employee
    const isEmployee: LeafQuery = { term: { type: "employee" } };
    const areFiltersApplied: boolean = Object.keys(userFilters).length > 0;
    const requiredFilters: FilterInput = {
      termId: termId,
      sectionsAvailable: true,
    };
    const filters: FilterInput = { ...requiredFilters, ...userFilters };

    const classFilters: QueryNode[] = _(filters)
      .pick(Object.keys(this.filters))
      .toPairs()
      .map(([key, val]) => this.filters[key].create(val))
      .value();

    const aggQuery = !aggregation
      ? undefined
      : {
          [aggregation]: {
            terms: {
              field: this.aggFilters[aggregation].agg,
              size: this.AGG_RES_SIZE,
            },
          },
        };

    // compound query for text query and filters
    return {
      from: min,
      size: max - min,
      sort: ["_score", sortByClassId],
      query: {
        bool: {
          must:
            phraseQueries.length === 0 && !fieldQueryExists
              ? MATCH_ALL_QUERY
              : phraseQueries,
          filter: {
            bool: {
              should: [
                { bool: { must: classFilters } },
                ...(!areFiltersApplied ? [isEmployee] : []),
              ],
            },
          },
          should: fieldQuery, //should match any remaining terms
          minimum_should_match: 0,
        },
      },
      aggregations: aggQuery,
    };
  }

  generateMQuery(
    query: string,
    termId: string,
    min: number,
    max: number,
    filters: FilterInput
  ): EsQuery[] {
    const validFilters: FilterInput = this.validateFilters(filters);

    const queries: EsQuery[] = [
      this.generateQuery(query, termId, validFilters, min, max),
    ];

    for (const fKey of Object.keys(this.aggFilters)) {
      const everyOtherFilter: FilterInput = _.omit(filters, fKey);
      queries.push(
        this.generateQuery(query, termId, everyOtherFilter, 0, 0, fKey)
      );
    }
    return queries;
  }

  async getSearchResults(
    query: string,
    termId: string,
    min: number,
    max: number,
    filters: FilterInput
  ): Promise<PartialResults> {
    const queries = this.generateMQuery(query, termId, min, max, filters);
    const results: EsMultiResult = await elastic.mquery(
      `${elastic.CLASS_ALIAS},${elastic.EMPLOYEE_ALIAS}`,
      queries
    );

    return this.parseResults(
      results.body.responses,
      Object.keys(this.aggFilters)
    );
  }

  parseResults(results: EsResultBody[], filters: string[]): PartialResults {
    return {
      output: results[0].hits.hits,
      resultCount: results[0].hits.total.value,
      took: results[0].took,
      aggregations: _.fromPairs(
        filters.map((filter, idx) => {
          return [
            filter,
            results[idx + 1].aggregations[filter].buckets.map((aggVal) => {
              return this.generateAgg(filter, aggVal.key, aggVal.doc_count);
            }),
          ];
        })
      ),
    };
  }

  generateAgg(filter: string, value: string, count: number): AggCount {
    const agg: AggCount = { value, count };
    // in addition to the subject abbreviation, add subject description for subject filter
    if (filter === "subject") {
      agg.description = this.subjects[value];
    }
    return agg;
  }

  async getOneSearchResult(
    subject: string,
    classId: string,
    termId: string
  ): Promise<SingleSearchResult> {
    const start = Date.now();

    const results = await this.getSearchResults(
      subject + classId,
      termId,
      0,
      9999,
      {
        subject: [subject],
      }
    );
    const result = results?.output[0];

    const hasSections = result?._source?.sections?.length > 0;
    const subjectMatches = result?._source?.class?.subject === subject;
    const codeMatches = result?._source?.class?.classId === classId;
    // Only show this course
    const showCourse = hasSections && subjectMatches && codeMatches;

    let aggregations: AggResults;
    let resultOutput: SearchResult[] = [];

    if (showCourse) {
      resultOutput = await new HydrateSerializer().bulkSerialize([result]);

      aggregations = this.getSingleResultAggs({
        ...result._source?.class,
        sections: result._source?.sections,
      });
    }

    return {
      results: resultOutput ?? [],
      resultCount: showCourse ? 1 : 0,
      took: 0,
      hydrateDuration: Date.now() - start,
      aggregations: aggregations ?? {
        nupath: [],
        subject: [],
        classType: [],
        campus: [],
        honors: [],
      },
    };
  }

  getSingleResultAggs(result: CourseWithSections): AggResults {
    return {
      nupath: result.nupath.map((val) => {
        return { value: val, count: 1 };
      }),
      subject: [this.generateAgg("subject", result.subject, 1)],
      classType: [{ value: result.sections[0].classType, count: 1 }],
      campus: [{ value: result.sections[0].campus, count: 1 }],
      honors: [{ value: result.sections[0].honors?.toString(), count: 1 }],
    };
  }

  /**
   * Given a current section, determine whether it matches the corresponding honors and campus filters
   * @param curSection the current section of a class
   * @param honorsFilter do we filter sections by honors?
   * @param campusFilter the campuses we are filtering by
   * @returns does the current section match the specified filters?
   */
  filterSection(
    curSection: Section,
    honorsFilter: EsValue,
    campusFilter: EsValue
  ): boolean {
    if (honorsFilter && !curSection.honors) {
      return false;
    }

    if (Array.isArray(campusFilter)) {
      if (
        campusFilter.length > 0 &&
        !campusFilter.includes(curSection.campus)
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * filters search results by the honors or campus filters present
   * @param filters the filters we are applying to the search results
   * @param results the search results
   * @returns the filtered search results
   */
  filterResults(filters, results): SearchResult[] {
    const validFilters = this.validateFilters(filters);

    const honorsFilter = validFilters["honors"] ?? false;

    const campusFilter = validFilters["campus"] ?? "";

    const filteredResults: SearchResult[] = [];

    if (!honorsFilter && campusFilter === "") {
      return results;
    }

    results.forEach((curResult: SearchResult) => {
      if (curResult.type === "class") {
        curResult.sections = curResult.sections.filter((curSection: Section) =>
          this.filterSection(curSection, honorsFilter, campusFilter)
        );

        if (curResult.sections.length > 0) {
          filteredResults.push(curResult);
        }
      } else {
        filteredResults.push(curResult);
      }
    });

    return filteredResults;
  }

  /**
   * Search for classes and employees
   * @param  {string}  query  The search to query for
   * @param  {string}  termId The termId to look within
   * @param  {number} min    The index of first document to retreive
   * @param  {number} max    The index of last document to retreive
   * @param filters
   */
  async search(
    query: string,
    termId: string,
    min: number,
    max: number,
    filters: FilterInput = {}
  ): Promise<SearchResults> {
    await this.initializeSubjects();
    const start = Date.now();

    let results: SearchResult[];
    let took: number;
    let hydrateDuration: number;
    let aggregations: AggResults;
    let resultCount = 0;
    // if we know that the query is of the format of a course code, we want to return only one result
    const isSingleCourse = query.match(this.COURSE_CODE_PATTERN);

    const subject = isSingleCourse ? isSingleCourse[1].toUpperCase() : "";
    const isSubjectValid = subject in this.subjects;

    const courseCode = isSingleCourse ? isSingleCourse[2] : "";
    const isCourseCodeValid = macros.isNumeric(courseCode);

    if (isSingleCourse && isSubjectValid && isCourseCodeValid) {
      const singleResult = await this.getOneSearchResult(
        subject,
        courseCode,
        termId
      );
      ({ results, resultCount, took, hydrateDuration, aggregations } =
        singleResult);
    } else {
      const searchResults = await this.getSearchResults(
        query,
        termId,
        min,
        max,
        filters
      );
      ({ took, resultCount, aggregations } = searchResults);
      const startHydrate = Date.now();
      results = await new HydrateSerializer().bulkSerialize(
        searchResults.output
      );
      hydrateDuration = Date.now() - startHydrate;
    }

    const filteredResults = this.filterResults(filters, results);

    return {
      searchContent: filteredResults,
      resultCount: resultCount,
      took: {
        total: Date.now() - start,
        hydrate: hydrateDuration,
        es: took,
      },
      aggregations,
    };
  }
}

const instance = new Searcher();
export default instance;
