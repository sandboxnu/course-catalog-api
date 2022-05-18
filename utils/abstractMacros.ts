/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

// Setup environmental constants. This is used in both the frontend and the backend. The process.env is set in webpack and in package.json
// These are setup in the webpack config

// This class is never instantiated.
// So there is no point in adding a constructor.
class Macros {
  static TEST: boolean;

  static DEV: boolean;

  static PROD: boolean;

  // Rollbar token
  static rollbarToken = "3a76015293344e6f9c47e35c9ce4c84c";

  // Google analytics token
  static googleAnalyticsToken = "UA-85376897-3";
}

// Set up the Macros.TEST, Macros.DEV, and Macros.PROD based on some env variables.
if (
  process.env.PROD ||
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "prod" ||
  (process.env.CI &&
    process.env.NODE_ENV !== "test" &&
    process.env.NODE_ENV !== "dev")
) {
  Macros.PROD = true;
  console.log("Running in prod mode."); // eslint-disable-line no-console
} else if (process.env.DEV || process.env.NODE_ENV === "dev") {
  Macros.DEV = true;
  console.log("Running in dev mode."); // eslint-disable-line no-console
} else if (process.env.NODE_ENV === "test") {
  Macros.TEST = true;
} else {
  console.log(`Unknown env! (${process.env.NODE_ENV}) Setting to dev.`); // eslint-disable-line no-console
  Macros.DEV = true;
}

if (!Macros.PROD) {
  Macros.PROD = false;
}

if (!Macros.DEV) {
  Macros.DEV = false;
}

if (!Macros.TEST) {
  Macros.TEST = false;
}

export default Macros;
