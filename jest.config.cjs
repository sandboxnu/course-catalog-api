const config = {
  extensionsToTreatAsEsm: [".ts"],
  transform: {},
  testURL: "http://localhost/",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  moduleFileExtensions: ["js", "json", "node", "ts"],
  testMatch: ["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)(spec|test).[jt]s?(x)"],
};

module.exports = config;
