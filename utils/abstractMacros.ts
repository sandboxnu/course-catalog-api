/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import util from "util";

// Setup environmental constants. This is used in both the frontend and the backend. The process.env is set in webpack and in package.json
// These are setup in the webpack config

// This class is never instantiated.
// So there is no point in adding a constructor.
class Macros {
  static TEST: boolean;

  static DEV: boolean;

  static PROD: boolean;

  // XXX: This is stuff that is hardcoded for now, need to change when expanding to other schools.
  static collegeName = "Northeastern University";

  static collegeHost = "neu.edu";

  // This is the same token in the frontend and the backend, and does not need to be kept private.
  static amplitudeToken = "e0801e33a10c3b66a3c1ac8ebff53359";

  // Rollbar token
  static rollbarToken = "3a76015293344e6f9c47e35c9ce4c84c";

  // Google analytics token
  static googleAnalyticsToken = "UA-85376897-3";

  // Use this for normal logging
  // Will log as normal, but stays silent during testing

  // We ignore the 'any' error, since console.log/warn/error all take the 'any' type
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  static log(...args: any): void {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    console.log(...args); // eslint-disable-line no-console
  }

  // We ignore the 'any' error, since console.log/warn/error all take the 'any' type
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  static warn(...args: any): void {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    args = ["Warning:"].concat(args);
    console.warn(...args);
  }

  // We ignore the 'any' error, since console.log/warn/error all take the 'any' type
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  static error(...args: any): void {
    if (Macros.TEST) {
      return;
    }

    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    const fullArgs: string[] = args.map((a: any) =>
      util.inspect(a, false, null, !Macros.PROD)
    );

    console.error("Error: ", ...fullArgs); // eslint-disable-line no-console
    console.trace(); // eslint-disable-line no-console
  }

  // https://stackoverflow.com/questions/18082/validate-decimal-numbers-in-javascript-isnumeric
  static isNumeric(n: any): boolean {
    return !Number.isNaN(Number.parseFloat(n)) && Number.isFinite(n);
  }
}

// Set up the Macros.TEST, Macros.DEV, and Macros.PROD based on some env variables.
if (
  process.env.PROD ||
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "prod" ||
  (process.env.CI &&
    process.env.NODE_ENV !== "test" &&
    process.env.NODE_ENV === "dev")
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
