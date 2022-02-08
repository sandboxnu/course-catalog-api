module.exports = {
  env: {
    es2021: true,
    jest: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:promise/recommended",
    "airbnb-base",
    "airbnb-typescript/base",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.eslint.json",
    ecmaVersion: 2021,
  },
  plugins: [
    "@typescript-eslint/eslint-plugin",
    "promise",
    "deprecation",
    "import",
  ],
  rules: {
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/camelcase": "off",
    "deprecation/deprecation": "warn",
    // This is overridden from AirBnB's guide, since they (subjectively) ban for..of loops.
    // https://github.com/airbnb/javascript/issues/1122#issuecomment-267580623
    "no-restricted-syntax": [
      "error",
      {
        selector: "ForInStatement",
        message:
          "for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.",
      },
    ],
    "no-underscore-dangle": "off",
    "no-param-reassign": ["error", { props: false }],
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
