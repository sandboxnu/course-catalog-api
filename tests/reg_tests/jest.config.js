module.exports = {
  name: "regtests",
  displayName: "Regression Tests",
  rootDir: "../../",
  testMatch: ["<rootDir>/tests/regtests/", "**/regtests/*"],
  moduleFileExtensions: ["js", "jsx", "json", "node", "tsx", "ts"],
  testPathIgnorePatterns: [
    "<rootDir>/tests/regtests/jest.config.js",
    "<rootDir>/tests/regtests/jestSetupFile.js",
  ],
  setupFiles: ["<rootDir>/tests/regtests/jestSetupFile.js"],
  testEnvironment: "node",
};
