import { gql } from "apollo-server";

const typeDef = gql`
  extend type Query {
    termIDs: [termID]
  }
  type TermID {
    termID: String
  }
`;

export default typeDef;
