import { gql } from 'apollo-server';

const typeDef = gql`
  extend type Query {
    search(
      termId: Int!
      query: String
      subject: [String!]
      nupath: [String!]
      campus: [String!]
      classType: [String!]
      classIdRange: IntRange

      """"
      Get elements after the given offset
      """
      offset: Int
      """
      Get n elements
      """
      first: Int
    ): SearchResultItemConnection
  }

  input IntRange {
    min: Int!
    max: Int!
  }

  type SearchResultItemConnection {
    totalCount: Int!
    pageInfo: PageInfo!
    nodes: [SearchResultItem]
  }

  union SearchResultItem = ClassOccurrence | Employee
`;

export default typeDef;
