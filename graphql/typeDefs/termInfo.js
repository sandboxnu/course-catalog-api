import gql from "graphql-tag";

const typeDef = gql`
  extend type Query {
    termInfos(subCollege: String!): [TermInfo!]!
  }

  type TermInfo {
    termId: String!
    subCollege: String!
    text: String!
  }
`;

export default typeDef;
