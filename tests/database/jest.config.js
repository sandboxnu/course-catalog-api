module.exports = {
  name: "dbtest",
  displayName: "Database Tests",
  rootDir: "./",
  moduleFileExtensions: ["js", "json", "node", "ts"],
  testMatch: ["**/*.(spec|test).seq.[jt]s?(x)"],
  testEnvironment: "<rootDir>/db_test_env.ts",
};
