module.exports = {
  displayName: "Database Tests",
  rootDir: "../../",
  moduleFileExtensions: ["js", "json", "node", "ts"],
  testMatch: ["**/*.(spec|test).seq.[jt]s?(x)"],
  testEnvironment: "<rootDir>/tests/database/dbTestEnv.ts",
};
