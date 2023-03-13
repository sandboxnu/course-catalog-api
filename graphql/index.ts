import { ApolloServer, gql } from "apollo-server";
import GraphQLJSON, { GraphQLJSONObject } from "graphql-type-json";
import macros from "../utils/macros.js";

import employeeTypeDef from "./typeDefs/employee.js";

import searchResolvers from "./resolvers/search.js";
import searchTypeDef from "./typeDefs/search.js";

import classResolvers from "./resolvers/class.js";
import classTypeDef from "./typeDefs/class.js";
import classOccurrenceTypeDef from "./typeDefs/classOccurrence.js";

import majorResolvers from "./resolvers/major.js";
import majorTypeDef from "./typeDefs/major.js";
import majorOccurrenceTypeDef from "./typeDefs/majorOccurrence.js";

import termInfoResolvers from "./resolvers/termInfo.js";
import termInfoTypeDef from "./typeDefs/termInfo.js";

if (macros.PROD || process.env.ENABLE_NOTIFS) {
  require("../twilio/server");
}

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
    termInfoTypeDef,
  ],
  resolvers: [
    JSONResolvers,
    classResolvers,
    majorResolvers,
    searchResolvers,
    termInfoResolvers,
  ],
  debug: true,
});

if (require.main === module) {
  server
    .listen()
    .then(({ url }) => {
      macros.log(`ready at ${url}`);
      return;
    })
    .catch((err) => {
      macros.error(`error starting graphql server: ${JSON.stringify(err)}`);
    });
}

export default server;
