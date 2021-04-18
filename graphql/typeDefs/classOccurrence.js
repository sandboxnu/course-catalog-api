import { gql } from "apollo-server";

const typeDef = gql`
  type ClassOccurrence {
    name: String!
    subject: String!
    classId: String!
    termId: Int!

    desc: String!
    prereqs: JSON
    coreqs: JSON
    prereqsFor: JSON
    optPrereqsFor: JSON
    maxCredits: Int
    minCredits: Int
    classAttributes: [String!]!
    url: String!
    prettyUrl: String
    lastUpdateTime: Float
    nupath: [String!]!
    sections: [Section!]!
    host: String!
    feeAmount: Int
    feeDescription: String
  }

  type Section {
    termId: String!
    subject: String!
    classId: String!
    classType: String!
    crn: String!
    seatsCapacity: Int!
    seatsRemaining: Int!
    waitCapacity: Int!
    waitRemaining: Int!
    campus: String!
    honors: Boolean!
    url: String!
    profs: [String!]!
    meetings: JSON
    host: String!
    lastUpdateTime: Float
  }
`;

export default typeDef;
