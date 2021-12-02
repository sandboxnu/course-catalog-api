import { gql } from "apollo-server";

const typeDef = gql`
  extend type Query {
    search(
      termId: String!
      query: String
      subject: [String!]
      nupath: [String!]
      termHalf: [String!]
      campus: [String!]
      classType: [String!]
      classIdRange: IntRange

      """
      "
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
    filterOptions: FilterOptions!
  }

  type FilterOptions {
    nupath: [FilterAgg!]
    subject: [FilterAgg!]
    classType: [FilterAgg!]
    campus: [FilterAgg!]
    termHalf: [FilterAgg!]
  }

  type FilterAgg {
    value: String!
    count: Int!
    description: String
  }

  union SearchResultItem = ClassOccurrence | Employee
`;

export default typeDef;
