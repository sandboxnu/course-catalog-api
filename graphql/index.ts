import { ApolloServer, gql } from "apollo-server";
import GraphQLJSON, { GraphQLJSONObject } from "graphql-type-json";
import macros from "../utils/macros";
import prisma from "../services/prisma";

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

  // TEMP / TODO - REMOVE / DO NOT LEAVE HERE PLEASE
  // Temp fix to address Prisma connection pool issues
  // https://github.com/prisma/prisma/issues/7249#issuecomment-1059719644
  const intervalTime = 6 * 60 * 60_000; // Every 6 hours

  if (!macros.TEST) {
    setInterval(async () => {
      const startTime = Date.now();
      await prisma.$disconnect();
      macros.log("Disconnected Prisma");
      await prisma.$connect();
      const totalTime = Date.now() - startTime;
      macros.log(
        `Reconnected Prisma - downtime of ${totalTime} ms (${
          totalTime / 60_000
        } mins)`
      );
    }, intervalTime);
  }
}

export default server;
