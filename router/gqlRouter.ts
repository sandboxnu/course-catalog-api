import { ApolloServer } from "@apollo/server";
import { gql } from "graphql-tag";
import GraphQLJSON, { GraphQLJSONObject } from "graphql-type-json";

import employeeTypeDef from "./typeDefs/employee.js";

import searchResolvers from "./resolvers/search.ts";
import searchTypeDef from "./typeDefs/search.js";

import classResolvers from "./resolvers/class.ts";
import classTypeDef from "./typeDefs/class.js";
import classOccurrenceTypeDef from "./typeDefs/classOccurrence.js";

import majorResolvers from "./resolvers/major.ts";
import majorTypeDef from "./typeDefs/major.js";
import majorOccurrenceTypeDef from "./typeDefs/majorOccurrence.js";

import termInfoResolvers from "./resolvers/termInfo.ts";
import termInfoTypeDef from "./typeDefs/termInfo.js";

// Enable JSON custom type
const JSONResolvers = {
  JSON: GraphQLJSON,
  JSONObject: GraphQLJSONObject,
};

// Base query so other typeDefs can do "extend type Query"
const baseQuery = gql`
  scalar JSON
  scalar JSONObject

  type Query {
    _empty: String
  }

  type PageInfo {
    # When paginating forwards, are there more items
    hasNextPage: Boolean!
  }
`;

export const server = new ApolloServer({
  typeDefs: [
    baseQuery,
    classTypeDef,
    classOccurrenceTypeDef,
    employeeTypeDef,
    majorTypeDef,
    majorOccurrenceTypeDef,
    searchTypeDef,
    termInfoTypeDef,
  ],
  resolvers: [
    JSONResolvers,
    classResolvers,
    majorResolvers,
    searchResolvers,
    termInfoResolvers,
  ],
});
