module.exports = {
  name: "regtests",
  displayName: "Regression Tests",
  rootDir: "../../",
  testMatch: ["<rootDir>/tests/reg_tests/", "**/reg_tests/*"],
  moduleFileExtensions: ["js", "jsx", "json", "node", "tsx", "ts"],
  testPathIgnorePatterns: [
    "<rootDir>/tests/reg_tests/jest.config.js",
    "<rootDir>/tests/reg_tests/jestSetupFile.js",
  ],
  setupFiles: ["<rootDir>/tests/reg_tests/jestSetupFile.js"],
  testEnvironment: "node",
};
