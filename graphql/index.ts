import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import gql from "graphql-tag";
import GraphQLJSON, { GraphQLJSONObject } from "graphql-type-json";
import macros from "../utils/macros";

import employeeTypeDef from "./typeDefs/employee";

import searchResolvers from "./resolvers/search";
import searchTypeDef from "./typeDefs/search";

import classResolvers from "./resolvers/class";
import classTypeDef from "./typeDefs/class";
import classOccurrenceTypeDef from "./typeDefs/classOccurrence";

import majorResolvers from "./resolvers/major";
import majorTypeDef from "./typeDefs/major";
import majorOccurrenceTypeDef from "./typeDefs/majorOccurrence";

import termInfoResolvers from "./resolvers/termInfo";
import termInfoTypeDef from "./typeDefs/termInfo";

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
  // debug: true,
});

console.log("hi");

// if (require.main === module) {
startStandaloneServer(server, {
  listen: { port: 3000 },
})
  .then(({ url }) => {
    macros.log(`ready at ${url}`);
    return;
  })
  .catch((err) => {
    macros.error(`error starting graphql server: ${JSON.stringify(err)}`);
  });
// }

export default server;
