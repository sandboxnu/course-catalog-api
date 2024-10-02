import gql from "graphql-tag";

const typeDef = gql`
  type Employee {
    name: String!
    firstName: String!
    lastName: String!
    email: String
    primaryDepartment: String
    primaryRole: String
    phone: String
    officeRoom: String
  }
`;

export default typeDef;
