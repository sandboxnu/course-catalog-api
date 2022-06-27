module.exports = {
  env: {
    es2021: true,
    jest: true,
    node: true,
  },
  // Unless you have a good reason, keep `extends` in the given order
  extends: [
    "eslint:recommended",
    // Overrides the settings from above ^ which don't apply to Typescript
    // Keep these 3 in the same order
    // "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:promise/recommended",
    // "airbnb-base",
    // "airbnb-typescript/base",
    // Overrides AirBnB styles; keep in this order
    "plugin:prettier/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.eslint.json",
    ecmaVersion: 2021,
  },
  plugins: ["@typescript-eslint/eslint-plugin", "deprecation", "prettier"],
  rules: {
    // // "@typescript-eslint/explicit-function-return-type": "off",
    // // "@typescript-eslint/explicit-module-boundary-types": "off",
    // // "@typescript-eslint/camelcase": "off",
    // "deprecation/deprecation": "warn",
    // // This is overridden from AirBnB's guide, since they (subjectively) ban for..of loops.
    // // https://github.com/airbnb/javascript/issues/1122#issuecomment-267580623
    // "no-restricted-syntax": [
    //   "error",
    //   {
    //     selector: "ForInStatement",
    //     message:
    //       "for..in loops iterate over the entire prototype chain, which is virtually never what you want. Use Object.{keys,values,entries}, and iterate over the resulting array.",
    //   },
    // ],
    // "no-underscore-dangle": "off",
    // "no-continue": "off",
    // "prefer-destructuring": "off",
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
        "@typescript-eslint/ban-ts-comment": ["warn"],
      },
    },
  ],
};
