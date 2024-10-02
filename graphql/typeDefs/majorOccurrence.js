import gql from "graphql-tag";

const typeDef = gql`
  type MajorOccurrence {
    majorId: String!
    yearVersion: String!

    spec: JSON!
    plansOfStudy: JSON!
  }
`;

export default typeDef;
