module.exports = {
  name: "workflow",
  displayName: "Tests for GitHub Workflows",
  rootDir: "../",
  moduleFileExtensions: ["js", "json", "node", "ts"],
  testMatch: ["**/*.(spec|test).git.[jt]s?"],
  testPathIgnorePatterns: [
    "<rootDir>/tests/workflow_tests/jest.config.js",
    "<rootDir>/node_modules",
    "<rootDir>/dist/",
  ],
};
