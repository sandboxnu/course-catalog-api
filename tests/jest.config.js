module.exports = {
  name: "dbtest",
  displayName: "Database Tests",
  rootDir: "../",
  moduleFileExtensions: ["js", "json", "node", "ts"],
  testMatch: ["**/*.(spec|test).seq.[jt]s?(x)"],
  testPathIgnorePatterns: [
    "<rootDir>/tests/jest.config.js",
    "<rootDir>/node_modules",
    "<rootDir>/dist/",
  ],
  testEnvironment: "<rootDir>/tests/db_test_env.ts",
};
