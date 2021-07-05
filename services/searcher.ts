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
} from "../types/search_types";

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
    const isString = (arg: any): arg is string => {
      return typeof arg === "string";
    };

    const isStringArray = (arg: any): arg is string[] => {
      return Array.isArray(arg) && arg.every((elem) => isString(elem));
    };

    const isTrue = (arg: any): arg is true => {
      return typeof arg === "boolean" && arg;
    };

    const isNum = (arg: any): arg is number => {
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
        macros.log("Invalid filter key.", currFilter);
      } else if (!this.filters[currFilter].validate(filters[currFilter])) {
        macros.log("Invalid filter value type.", currFilter);
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
    // text query from the main search box
    const matchTextQuery: LeafQuery =
      query.length > 0
        ? {
            multi_match: {
              query: query,
              type: "most_fields", // More fields match => higher score
              fields: fields,
            },
          }
        : MATCH_ALL_QUERY;

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
          must: matchTextQuery,
          filter: {
            bool: {
              should: [
                { bool: { must: classFilters } },
                ...(!areFiltersApplied ? [isEmployee] : []),
              ],
            },
          },
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
      `${elastic.CLASS_INDEX},${elastic.EMPLOYEE_INDEX}`,
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
   * @param  {integer} min    The index of first document to retreive
   * @param  {integer} max    The index of last document to retreive
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
