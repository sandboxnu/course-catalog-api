/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import { Employee, Course, Section } from "./types";

/****************** UTILS ******************/
type OneOrMany<T> = T | T[];

/***************** QUERIES *****************/
export interface EsQuery {
  from: number;
  size: number;
  sort: EsSort;
  query: QueryNode;
  aggregations?: QueryAgg;
}

type EsValue = string | string[] | boolean | Range;

export interface Range {
  min: number;
  max: number;
}

// every query is either a leaf query or a bool query
export type QueryNode = LeafQuery | BoolQuery;

// ====== Leaf Queries =======
export type LeafQuery =
  | TermQuery
  | TermsQuery
  | ExistsQuery
  | MultiMatchQuery
  | RangeQuery
  | MatchAllQuery
  | BoolQuery;

export interface TermQuery {
  term: FieldQuery;
}

export interface TermsQuery {
  terms: FieldQuery;
}

export interface MultiMatchQuery {
  multi_match: {
    query: string;
    type: string;
    fields: string[];
  };
}

export interface RangeQuery {
  range: {
    [fieldName: string]: {
      gte?: number;
      gt?: number;
      lte?: number;
      lt?: number;
    };
  };
}

export interface QueryWithType {
  query: string;
  type: "phrase" | "most_fields";
}

export const MATCH_ALL_QUERY = { match_all: {} };
export type MatchAllQuery = typeof MATCH_ALL_QUERY;

export interface ExistsQuery {
  exists: { field: string };
}

export interface FieldQuery {
  [fieldName: string]: EsValue;
}
// ====== Bool Queries =======
export interface BoolQuery {
  bool: BoolType;
}

export type BoolType = MustQuery | ShouldQuery | FilterQuery;

/**
 * The below three Query types have the same structure.
 * The only difference is what string shows up first.
 * But, they need to be separate types, because they mean very different things.
 * Not sure how to solve.
 */
export interface MustQuery {
  must: OneOrMany<QueryNode>;
}

export interface ShouldQuery {
  should: OneOrMany<QueryNode>;
  minimum_should_match?: number;
}

export interface FilterQuery {
  filter: OneOrMany<QueryNode>;
}

// ====== Misc. Queries ======
export type EsSort = [SortType, SortInfo];
type SortType = string;

export interface SortInfo {
  [fieldName: string]: {
    order: string;
    unmapped_type: string;
  };
}

export interface QueryAgg {
  [aggName: string]: {
    terms: {
      field: string;
      size?: number;
    };
  };
}

// ========= Filters =========
export type FilterInput = {
  [filterName: string]: EsValue;
};

interface FilterStruct<Input> {
  validate: (input: Input) => boolean;
  create: (input: Input) => LeafQuery;
  agg: AggProp;
}

export type EsFilterStruct = FilterStruct<EsValue>;

export type FilterPrelude = Record<string, EsFilterStruct>;

// ======= Agg Filters =======
export type AggProp = false | string;

interface AggFilterStruct<Input> extends FilterStruct<Input> {
  agg: string;
}

export type EsAggFilterStruct = AggFilterStruct<EsValue>;

export type AggFilterPrelude = Record<string, EsAggFilterStruct>;

/*************** ES RESULTS ****************/
// TODO blocked a bit by new ORM, trying to avoid duplication
export type EsResult = any;

export type EsMultiResult = {
  body: {
    responses: EsResultBody[];
  };
};

export interface EsResultBody {
  took: number;
  hits: {
    total: { value: number };
    hits: EsResult[];
    value: number;
  };
  aggregations: EsAggResults;
}

export interface EsAggResults {
  [aggName: string]: {
    buckets: Array<{ key: string; doc_count: number }>;
  };
}

/************* SEARCH RESULTS **************/
export interface SearchResults {
  searchContent: SearchResult[];
  resultCount: number;
  took: {
    total: number;
    hydrate: number;
    es: number;
  };
  aggregations: AggResults;
}

export interface PartialResults {
  output: EsResult[];
  resultCount: number;
  took: number;
  aggregations: AggResults;
}

export interface SingleSearchResult {
  results: SearchResult[];
  resultCount: number;
  took: number;
  hydrateDuration: number;
  aggregations: AggResults;
}

export interface AggCount {
  value: string;
  count: number;
  description?: string;
}

export interface AggResults {
  [filterName: string]: AggCount[];
}

export type CourseSearchResult = {
  type: "class";
  class: Course;
  sections: Section[];
};
export type ProfessorSearchResult = { type: "employee"; employee: Employee };

export type SearchResult = CourseSearchResult | ProfessorSearchResult;

/**************** ES UTILS *****************/
export type EsMapping = Record<string, any>;

// TODO value is a Document--something we insert into ES
export type EsBulkData = Record<string, any>;
