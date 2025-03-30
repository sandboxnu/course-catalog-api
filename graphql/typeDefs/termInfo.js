import { gql } from "apollo-server";

const typeDef = gql`
  extend type Query {
    termInfos(subCollege: String!): [TermInfo!]!
  }

  type TermInfo {
    termId: String!
    subCollege: String!
    text: String!
    active: Boolean!
  }
`;

export default typeDef;
