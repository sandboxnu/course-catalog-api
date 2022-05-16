/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import "colors";
import util from "util";
import path from "path";
import fs from "fs-extra";
import "winston-daily-rotate-file";
import Rollbar, { MaybeError } from "rollbar";
import Amplitude from "amplitude";
import dotenv from "dotenv";
import { AmplitudeTrackResponse } from "amplitude/dist/responses";
import { AmplitudeEvent } from "../types/requestTypes";
import { createLogger, format, transports } from "winston";

dotenv.config();

// This is the same token in the frontend and the backend, and does not need to be kept private.
const AMPLITUDE = new Amplitude("e0801e33a10c3b66a3c1ac8ebff53359");

// Change the current working directory to the directory with package.json and .git folder.
const originalCwd: string = process.cwd();
let oldcwd: null | string = null;

while (oldcwd !== process.cwd()) {
  try {
    fs.statSync("package.json");
  } catch (e) {
    oldcwd = process.cwd();
    //cd .. until in the same dir as package.json, the root of the project
    process.chdir("..");

    // Prevent an infinite loop: If we keep cd'ing upward and we hit the root dir and still haven't found
    // a package.json, just return to the original directory and break out of this loop.
    if (oldcwd === process.cwd()) {
      console.warn(
        "Can't find directory with package.json, returning to",
        originalCwd
      );
      process.chdir(originalCwd);
      break;
    }
    continue;
  }
  break;
}

enum LogLevel {
  CRITICAL = -1,
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  HTTP = 3,
  VERBOSE = 4,
}

function getLogLevel(input: string): LogLevel {
  input = input ? input.toUpperCase() : "";
  return (LogLevel as any)[input] || LogLevel.INFO;
}

type EnvKeys =
  | "elasticURL"
  | "dbName"
  | "dbHost"
  // Secrets:
  | "dbUsername"
  | "dbPassword"
  | "rollbarPostServerItemToken"
  | "fbToken"
  | "fbVerifyToken"
  | "fbAppSecret"
  // Only for dev:
  | "fbMessengerId";

type EnvVars = Partial<Record<EnvKeys, string>>;

// This is the JSON object saved in /etc/searchneu/config.json
// null = hasen't been loaded yet.
// {} = it has been loaded, but nothing was found or the file doesn't exist or the file was {}
// {...} = the file
let envVariables: EnvVars = null;

class Macros {
  static TEST = false;
  static DEV = false;
  static PROD = false;

  static logLevel = getLogLevel(process.env.LOG_LEVEL);

  static dirname = "logs/" + (Macros.PROD ? "prod" : "dev");

  static logger = createLogger({
    level: "info",
    format: format.combine(
      format.timestamp({
        format: "YYYY-MM-DD HH:mm:ss",
      }),
      format.errors({ stack: true }),
      format.splat(),
      format.json()
    ),
    defaultMeta: { service: "course-catalog-api" },
    transports: [
      new transports.DailyRotateFile({
        filename: "%DATE%-warn.log",
        level: "warn",
        dirname: Macros.dirname,
        maxSize: "10m",
        maxFiles: "180d",
        zippedArchive: true,
      }),
      new transports.DailyRotateFile({
        filename: "%DATE%-info.log",
        level: "info",
        dirname: Macros.dirname,
        maxSize: "10m",
        maxFiles: "60d",
        zippedArchive: true,
      }),
      new transports.DailyRotateFile({
        filename: "%DATE%-verbose.log",
        level: "verbose",
        dirname: Macros.dirname,
        maxSize: "20m",
        maxFiles: "15d",
        zippedArchive: true,
      }),
    ],
  });
  // Version of the schema for the data. Any changes in this schema will effect the data saved in the dev_data folder
  // and the data saved in the term dumps in the public folder and the search indexes in the public folder.
  // Increment this number every time there is a breaking change in the schema.
  // This will cause the data to be saved in a different folder in the public data folder.
  // The first schema change is here: https://github.com/ryanhugh/searchneu/pull/48
  static schemaVersion = 2;

  static PUBLIC_DIR = path.join("public", "data", `v${Macros.schemaVersion}`);

  static DEV_DATA_DIR = path.join("dev_data", `v${Macros.schemaVersion}`);

  // Folder of the raw html cache for the requests.
  static REQUESTS_CACHE_DIR = "requests";

  private static rollbar: Rollbar =
    Macros.PROD &&
    new Rollbar({
      accessToken: Macros.getEnvVariable("rollbarPostServerItemToken"),
      captureUncaught: true,
      captureUnhandledRejections: true,
    });

  static getAllEnvVariables(): EnvVars {
    if (envVariables) {
      return envVariables;
    }

    let configFileName = "/etc/searchneu/config.json";

    // Yes, this is syncronous instead of the normal Node.js async style
    // But keeping it sync helps simplify other parts of the code
    // and it only takes 0.2 ms on my Mac.

    let exists = fs.existsSync(configFileName);

    // Also check /mnt/c/etc... in case we are running inside WSL.
    if (!exists) {
      configFileName = "/mnt/c/etc/searchneu/config.json";
      exists = fs.existsSync(configFileName);
    }

    if (!exists) {
      envVariables = {};
    } else {
      envVariables = JSON.parse(fs.readFileSync(configFileName, "utf8"));
    }

    envVariables = Object.assign(envVariables, process.env);

    return envVariables;
  }

  // Gets the current time, just used for logging
  static getTime(): string {
    return moment().format("hh:mm:ss a");
  }

  static getEnvVariable(name: EnvKeys): string {
    return this.getAllEnvVariables()[name];
  }

  // Log an event to amplitude. Same function signature as the function for the frontend.
  static async logAmplitudeEvent(
    type: string,
    event: AmplitudeEvent
  ): Promise<null | void | AmplitudeTrackResponse> {
    if (!Macros.PROD) {
      return null;
    }

    const data = {
      event_type: type,
      device_id: `Backend ${type}`,
      session_id: Date.now(),
      event_properties: event,
    };

    return AMPLITUDE.track(data).catch((error) => {
      Macros.warn("error Logging amplitude event failed:", error);
    });
  }

  static getRollbar(): Rollbar {
    if (Macros.PROD && !this.rollbar) {
      console.error("Don't have rollbar so not logging error in prod?"); // eslint-disable-line no-console
    }

    return this.rollbar;
  }

  // Takes an array of a bunch of thigs to log to rollbar
  // Any of the times in the args array can be an error, and it will be logs according to rollbar's API
  // shouldExit - exit after logging.
  static logRollbarError(args: { stack: unknown }, shouldExit: boolean): void {
    // Don't log rollbar stuff outside of Prod
    if (!Macros.PROD) {
      return;
    }

    // The middle object can include any properties and values, much like amplitude.
    args.stack = new Error().stack;

    // Search through the args array for an error. If one is found, log that separately.
    let possibleError: MaybeError;

    for (const value of Object.values(args)) {
      if (value instanceof Error) {
        possibleError = value;
        break;
      }
    }

    console.log("sending to rollbar", possibleError, args);

    if (possibleError) {
      // The arguments can come in any order. Any errors should be logged separately.
      // https://docs.rollbar.com/docs/nodejs#section-rollbar-log-
      Macros.getRollbar().error(possibleError, args, () => {
        if (shouldExit) {
          // And kill the process to recover.
          // forver.js will restart it.
          process.exit(1);
        }
      });
    } else {
      Macros.getRollbar().error(args, () => {
        if (shouldExit) {
          process.exit(1);
        }
      });
    }
  }

  // This is for programming errors. This will cause the program to exit anywhere.
  // This *should* never be called.

  // We ignore the 'any' error, since console.log/warn/error all take the 'any' type
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  static critical(...args: any): void {
    Macros.logger.error(args);

    if (Macros.TEST) {
      console.error("macros.critical called");
      console.error(
        "Consider using the VERBOSE env flag for more info",
        ...args
      );
    } else {
      Macros.error(...args);
      process.exit(1);
    }
  }

  // Use this for stuff that is bad, and shouldn't happen, but isn't mission critical and can be ignored and the app will continue working
  // Will log something to rollbar and rollbar will send off an email

  // We ignore the 'any' error, since console.log/warn/error all take the 'any' type
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  static warn(...args: any): void {
    Macros.logger.warn(args);

    if (LogLevel.WARN > Macros.logLevel) {
      return;
    }

    if (!Macros.TEST) {
      const warning = [
        "Warning:",
        ...args.map((a) => (typeof a === "string" ? a.yellow.underline : a)),
      ];
      console.warn(...warning);
    }

    if (Macros.PROD) {
      this.logRollbarError(args, false);
    }
  }

  // Use this for stuff that should never happen, but does not mean the program cannot continue.
  // This will continue running in dev, but will exit on CI
  // Will log stack trace and cause CI to fail,  so CI will send an email

  // We ignore the 'any' error, since console.log/warn/error all take the 'any' type
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  static error(...args: any): void {
    Macros.logger.error(args);

    if (!Macros.TEST) {
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      const fullArgs: string[] = args.map((a: any) =>
        util.inspect(a, false, null, !Macros.PROD)
      );

      console.error(
        "\n\nCheck the /logs directory for more verbose logs\n\n".blue
          .underline,
        ...fullArgs
      ); // eslint-disable-line no-console
      console.trace(); // eslint-disable-line no-console
    }

    if (Macros.PROD) {
      // If running on Travis, just exit 1 and travis will send off an email.
      if (process.env.CI) {
        process.exit(1);

        // If running on AWS, tell rollbar about the error so rollbar sends off an email.
      } else {
        this.logRollbarError(args, false);
      }
    }
  }

  static log(...args: any): void {
    Macros.logger.info(args);

    if (LogLevel.INFO > Macros.logLevel) {
      return;
    }

    console.log(...args);
  }

  static http(...args: any): void {
    Macros.logger.http(args);

    if (LogLevel.HTTP > Macros.logLevel) {
      return;
    }

    console.log(...args);
  }

  // Use console.warn to log stuff during testing
  // We ignore the 'any' error, since console.log/warn/error all take the 'any' type
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  static verbose(...args: any): void {
    Macros.logger.verbose(args);

    if (LogLevel.VERBOSE > Macros.logLevel) {
      return;
    }

    console.log(...args);
  }

  // https://stackoverflow.com/questions/18082/validate-decimal-numbers-in-javascript-isnumeric
  static isNumeric(n: string): boolean {
    return (
      !Number.isNaN(Number.parseFloat(n)) && Number.isFinite(Number.parseInt(n))
    );
  }
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

Macros.log(
  `**** Starting using log level: ${Macros.logLevel} (${
    LogLevel[Macros.logLevel]
  })`
);
Macros.log(
  "**** Change the log level using the 'LOG_LEVEL' environment variable"
);

console.log(Macros.getEnvVariable("rollbarPostServerItemToken"));
console.log(process.env["rollbarPostServerItemToken"]);
export default Macros;
