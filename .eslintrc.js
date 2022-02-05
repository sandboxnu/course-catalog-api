module.exports = {
  env: {
    browser: true,
    es6: true,
    jest: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended",
    "plugin:promise/recommended",
    "airbnb-base",
    "airbnb-typescript/base",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.eslint.json",
    ecmaVersion: 2021,
  },
  plugins: ["@typescript-eslint/eslint-plugin", "deprecation"],
  rules: {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/camelcase": "off",
    "deprecation/deprecation": "warn",
  },
  overrides: [
    {
      files: ["*.js", "*.ts"],
      rules: {
        "@typescript-eslint/explicit-function-return-type": [
          "warn",
          {
            allowExpressions: true,
          },
        ],
        "@typescript-eslint/explicit-module-boundary-types": "off",
      },
    },
  ],
};
