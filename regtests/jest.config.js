module.exports = {
  name: "regtests",
  displayName: "Regression Tests",
  rootDir: "../",
  testMatch: ["<rootDir>/regtests/"],
  setupFiles: undefined,
  moduleFileExtensions: ["js", "jsx", "json", "node", "tsx", "ts"],
  testMatch: ["**/regtests/*"],
  testPathIgnorePatterns: [
    "<rootDir>/regtests/jest.config.js",
    "<rootDir>/regtests/jestSetupFile.js",
  ],
  setupFiles: ["<rootDir>/regtests/jestSetupFile.js"],
  testEnvironment: "node",
};
