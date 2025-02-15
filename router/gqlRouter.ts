import { ApolloServer } from "@apollo/server";
import { gql } from "graphql-tag";
import GraphQLJSON, { GraphQLJSONObject } from "graphql-type-json";

import employeeTypeDef from "./typeDefs/employee.js";

import searchResolvers from "./resolvers/search";
import searchTypeDef from "./typeDefs/search.js";

import classResolvers from "./resolvers/class";
import classTypeDef from "./typeDefs/class.js";
import classOccurrenceTypeDef from "./typeDefs/classOccurrence.js";

import termInfoResolvers from "./resolvers/termInfo";
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
    searchTypeDef,
    termInfoTypeDef,
  ],
  resolvers: [
    JSONResolvers,
    classResolvers,
    searchResolvers,
    termInfoResolvers,
  ],
});
