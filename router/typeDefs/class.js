import { gql } from "apollo-server";

const typeDef = gql`
  extend type Query {
    class(subject: String!, classId: String!): Class
    bulkClasses(input: [BulkClassInput!]!): [Class!]
    classByHash(hash: String!): ClassOccurrence
    sectionByHash(hash: String!): Section
  }

  input BulkClassInput {
    subject: String!
    classId: String!
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
