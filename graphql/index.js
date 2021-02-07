import { ApolloServer, gql } from "apollo-server";
import GraphQLJSON, { GraphQLJSONObject } from "graphql-type-json";
import macros from "../macros";

import employeeTypeDef from "./typeDefs/employee";

import searchResolvers from "./resolvers/search";
import searchTypeDef from "./typeDefs/search";

import classResolvers from "./resolvers/class";
import classTypeDef from "./typeDefs/class";
import classOccurrenceTypeDef from "./typeDefs/classOccurrence";

import majorResolvers from "./resolvers/major";
import majorTypeDef from "./typeDefs/major";
import majorOccurrenceTypeDef from "./typeDefs/majorOccurrence";

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

const server = new ApolloServer({
  typeDefs: [
    baseQuery,
    classTypeDef,
    classOccurrenceTypeDef,
    employeeTypeDef,
    majorTypeDef,
    majorOccurrenceTypeDef,
    searchTypeDef,
  ],
  resolvers: [JSONResolvers, classResolvers, majorResolvers, searchResolvers],
});

if (require.main === module) {
  server.listen().then(({ url }) => {
    macros.log(`ready at ${url}`);
  });
}

export default server;
