import { gql } from "apollo-server";

const typeDef = gql`
  extend type Query {
    class(subject: String!, classId: String!): Class
    classByHash(hash: String!): ClassOccurrence
    sectionByHash(hash: String!): Section
  }

  type Class {
    name: String!
    subject: String!
    classId: String!

    occurrence(termId: String!): ClassOccurrence
    latestOccurrence: ClassOccurrence
    allOccurrences: [ClassOccurrence]!
  }
`;

export default typeDef;
