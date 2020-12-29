import { gql } from 'apollo-server';

const typeDef = gql`
  type Employee {
    name: String!
    firstName: String!
    lastName: String!
    emails: [String!]!
    primaryDepartment: String
    primaryRole: String
    phone: String
    url: String
    streetAddress: String
    personalSite: String
    googleScholarId: String
    bigPictureUrl: String
    pic: String
    link: String
    officeRoom: String
  }
`;

export default typeDef;
