/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import _ from "lodash";
import { Course, Section } from "@prisma/client";
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
  CourseSearchResult,
  QueryWithType,
} from "../types/searchTypes";

type CourseWithSections = Course & { sections: Section[] };
type SSRSerializerOutput = { [id: string]: CourseSearchResult };

class Searcher {
  elastic: Elastic;

  subjects: Record<string, string>;

  filters: FilterPrelude;

  aggFilters: AggFilterPrelude;

  AGG_RES_SIZE: number;

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

    return {
      nupath: {
        validate: isStringArray,
        create: getNUpathFilter,
        agg: "class.nupath.keyword",
      },
      subject: {
        validate: isStringArray,
        create: getSubjectFilter,
        agg: "class.subject.keyword",
      },
      classType: {
        validate: isStringArray,
        create: getClassTypeFilter,
        agg: "sections.classType.keyword",
      },
      sectionsAvailable: {
        validate: isTrue,
        create: getSectionsAvailableFilter,
        agg: false,
      },
      classIdRange: { validate: isRange, create: getRangeFilter, agg: false },
      termId: { validate: isString, create: getTermIdFilter, agg: false },
      campus: {
        validate: isStringArray,
        create: getCampusFilter,
        agg: "sections.campus.keyword",
      },
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
   * return a set of all existing subjects of classes
   */
  getSubjects(): Record<string, string> {
    return this.subjects;
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
      "employee.emails",
      "employee.phone",
    ];
  }

  /**
   * Given a string, creates a list of queries that are either phrase queries or
   * most_field queries. Phrases are between quotes, and use phrase matching.
   * Most_field queries are everything else, and search the terms on all fields.
   * else.
   * @param query the string that is parsed into a list
   * @returns a list of queries
   */
  parseQuery(query: string): QueryWithType[] {
    const ret = [];
    let curString = "";
    let isPhrase: boolean = false;

    for (let i = 0; i < query.length; i++) {
      //if we find a quote, we want to make the correct query and push it onto the return list
      if (query[i] === '"') {
        if (curString.trim() !== "") {
          //add the query with the current string, with the correct type
          ret.push({
            query: curString,
            type: isPhrase ? "phrase" : "most_fields",
          });
        }
        //change the toggle everytime you see a quote
        isPhrase = !isPhrase;
        //reset the current string
        curString = "";
      } else {
        //otherwise add to the current string.
        curString += query[i];
      }
    }
    //if the current string is not empty, add whatever we have left.
    if (curString !== "") {
      ret.push({
        query: curString,
        type: isPhrase ? "phrase" : "most_fields",
      });
    }

    return ret;
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
    const fields: string[] = this.getFields();

    const queryArr: QueryWithType[] = this.parseQuery(query);

    //a list of all phrase queries
    const matchQueries: LeafQuery[] = [];

    //a most_field query, containing all non-phrase terms combined.
    let fieldQuery: LeafQuery;

    //are there any field Queries?
    let fieldQExists: boolean = false;

    //the current fields string, we want to build a single query with all
    //the terms that are not phrases.
    let fieldStr: string = "";
    for (let i = 0; i < queryArr.length; ++i) {
      //if the type is phrase, add a phrase query with the term
      if (queryArr[i].type === "phrase") {
        matchQueries.push({
          multi_match: {
            query: queryArr[i].query,
            type: "phrase",
            fields: fields,
          },
        });
      }
      //add the query to the current string
      else {
        fieldStr += queryArr[i].query + " ";
      }
    }

    //if the fields string is not empty, create a field query with this string
    if (fieldStr !== "") {
      fieldQuery = {
        multi_match: {
          query: fieldStr,
          type: "most_fields",
          fields: fields,
        },
      };

      fieldQExists = true;
    }

    //if there was an empty search, match_all
    if (matchQueries.length === 0 && fieldQExists) {
      matchQueries.push(MATCH_ALL_QUERY);
    }

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
          must: matchQueries, //must match all the phrases
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
    console.log(JSON.stringify(queries[0]));
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
    const result = await prisma.course.findUnique({
      where: { uniqueCourseProps: { classId, subject, termId } },
      include: { sections: true },
    });
    const serializer = new HydrateCourseSerializer();
    const showCourse = result && result.sections && result.sections.length > 0;
    // don't show search result of course with no sections
    const resultOutput: SSRSerializerOutput = (
      showCourse ? await serializer.bulkSerialize([result]) : {}
    ) as SSRSerializerOutput;
    const results: SearchResult[] = Object.values(resultOutput);
    return {
      results,
      resultCount: showCourse ? 1 : 0,
      took: 0,
      hydrateDuration: Date.now() - start,
      aggregations: showCourse
        ? this.getSingleResultAggs(result)
        : {
            nupath: [],
            subject: [],
            classType: [],
            campus: [],
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
    };
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
    let resultCount: number;
    let took: number;
    let hydrateDuration: number;
    let aggregations: AggResults;
    // if we know that the query is of the format of a course code, we want to return only one result
    const patternResults = query.match(this.COURSE_CODE_PATTERN);
    const subject = patternResults ? patternResults[1].toUpperCase() : "";
    if (
      patternResults &&
      macros.isNumeric(patternResults[2]) &&
      subject in this.getSubjects()
    ) {
      ({ results, resultCount, took, hydrateDuration, aggregations } =
        await this.getOneSearchResult(subject, patternResults[2], termId));
    } else {
      const searchResults = await this.getSearchResults(
        query,
        termId,
        min,
        max,
        filters
      );
      ({ resultCount, took, aggregations } = searchResults);
      const startHydrate = Date.now();

      results = await new HydrateSerializer().bulkSerialize(
        searchResults.output
      );
      hydrateDuration = Date.now() - startHydrate;
    }
    return {
      searchContent: results,
      resultCount,
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
