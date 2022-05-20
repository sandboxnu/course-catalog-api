/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import util from "util";
import path from "path";
import fs from "fs-extra";
import Rollbar, { MaybeError } from "rollbar";
import Amplitude from "amplitude";
import dotenv from "dotenv";
import { AmplitudeTrackResponse } from "amplitude/dist/responses";
import { AmplitudeEvent } from "../types/requestTypes";
import "colors";
import { createLogger, format, Logger, transports } from "winston";
import "winston-daily-rotate-file";

dotenv.config();

// This is the same token in the frontend and the backend, and does not need to be kept private.
const amplitude = new Amplitude("e0801e33a10c3b66a3c1ac8ebff53359");

// Collection of small functions that are used in many different places in the backend.
// This includes things related to saving and loading the dev data, parsing specific fields from pages and more.
// Would be ok with splitting up this file into separate files (eg, one for stuff related to scraping and another one for other stuff) if this file gets too big.
// Stuff in this file can be specific to the backend and will only be ran in the backend.
// If it needs to be ran in both the backend and the frontend, move it to the common macros file :P

// TODO: improve getBaseHost by using a list of top level domains. (public on the internet)

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

// This is the JSON object saved in /etc/searchneu/config.json
// null = hasen't been loaded yet.
// {} = it has been loaded, but nothing was found or the file doesn't exist or the file was {}
// {...} = the file
let envVariables = null;

enum EnvLevel {
  PROD,
  TEST,
  DEV,
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
  input = input ? input : "";

  switch (input.toUpperCase()) {
    case "CRITICAL":
      return LogLevel.CRITICAL;
    case "ERROR":
      return LogLevel.ERROR;
    case "WARN":
      return LogLevel.WARN;
    case "INFO":
      return LogLevel.INFO;
    case "HTTP":
      return LogLevel.HTTP;
    case "VERBOSE":
      return LogLevel.VERBOSE;
    default:
      return LogLevel.INFO;
  }
}

let environmentLevel;
// Set up the Macros.TEST, Macros.DEV, and Macros.PROD based on some env variables.
if (
  process.env.PROD ||
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "prod" ||
  (process.env.CI &&
    process.env.NODE_ENV !== "test" &&
    process.env.NODE_ENV !== "dev")
) {
  environmentLevel = EnvLevel.PROD;
  console.log("Running in prod mode."); // eslint-disable-line no-console
} else if (process.env.DEV || process.env.NODE_ENV === "dev") {
  environmentLevel = EnvLevel.DEV;
  console.log("Running in dev mode."); // eslint-disable-line no-console
} else if (process.env.NODE_ENV === "test") {
  environmentLevel = EnvLevel.TEST;
} else {
  console.log(`Unknown env! (${process.env.NODE_ENV}) Setting to dev.`); // eslint-disable-line no-console
  environmentLevel = EnvLevel.DEV;
}

class Macros {
  // Version of the schema for the data. Any changes in this schema will effect the data saved in the dev_data folder
  // and the data saved in the term dumps in the public folder and the search indexes in the public folder.
  // Increment this number every time there is a breaking change in the schema.
  // This will cause the data to be saved in a different folder in the public data folder.
  // The first schema change is here: https://github.com/ryanhugh/searchneu/pull/48
  readonly schemaVersion = 2;
  readonly PUBLIC_DIR = path.join("public", "data", `v${this.schemaVersion}`);
  readonly DEV_DATA_DIR = path.join("dev_data", `v${this.schemaVersion}`);

  // Folder of the raw html cache for the requests.
  readonly REQUESTS_CACHE_DIR = "requests";

  readonly logLevel: LogLevel;
  readonly dirname: string;
  private rollbar: Rollbar;

  PROD: boolean;
  TEST: boolean;
  DEV: boolean;

  logger: Logger;

  constructor() {
    this.logLevel = getLogLevel(process.env.LOG_LEVEL);

    this.PROD = environmentLevel === EnvLevel.PROD;
    this.TEST = environmentLevel === EnvLevel.TEST;
    this.DEV = environmentLevel === EnvLevel.DEV;

    this.rollbar =
      this.PROD &&
      new Rollbar({
        accessToken: this.getEnvVariable("rollbarPostServerItemToken"),
        captureUncaught: true,
        captureUnhandledRejections: true,
      });

    this.dirname = "logs/" + (this.PROD ? "prod" : "dev");

    this.logger = createLogger({
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
          dirname: this.dirname,
          maxSize: "10m",
          maxFiles: "180d",
          zippedArchive: true,
        }),
        new transports.DailyRotateFile({
          filename: "%DATE%-info.log",
          level: "info",
          dirname: this.dirname,
          maxSize: "10m",
          maxFiles: "60d",
          zippedArchive: true,
        }),
        new transports.DailyRotateFile({
          filename: "%DATE%-verbose.log",
          level: "verbose",
          dirname: this.dirname,
          maxSize: "20m",
          maxFiles: "15d",
          zippedArchive: true,
        }),
      ],
    });
  }

  getAllEnvVariables(): typeof process.env {
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

  getEnvVariable(name: string): string {
    return this.getAllEnvVariables()[name];
  }

  // Log an event to amplitude. Same function signature as the function for the frontend.
  async logAmplitudeEvent(
    type: string,
    event: AmplitudeEvent
  ): Promise<null | void | AmplitudeTrackResponse> {
    if (!this.PROD) {
      return null;
    }

    const data = {
      event_type: type,
      device_id: `Backend ${type}`,
      session_id: Date.now(),
      event_properties: event,
    };

    return amplitude.track(data).catch((error) => {
      this.warn("error Logging amplitude event failed:", error);
    });
  }

  getRollbar(): Rollbar {
    if (this.PROD && !this.rollbar) {
      console.error("Don't have rollbar so not logging error in prod?"); // eslint-disable-line no-console
    }

    return this.rollbar;
  }

  // Takes an array of a bunch of thigs to log to rollbar
  // Any of the times in the args array can be an error, and it will be logs according to rollbar's API
  // shouldExit - exit after logging.
  logRollbarError(args: { stack: unknown }, shouldExit: boolean): void {
    // Don't log rollbar stuff outside of Prod
    if (!this.PROD) {
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
      this.getRollbar().error(possibleError, args, () => {
        if (shouldExit) {
          // And kill the process to recover.
          // forver.js will restart it.
          process.exit(1);
        }
      });
    } else {
      this.getRollbar().error(args, () => {
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
  critical(...args: any): void {
    this.logger.error(args);

    if (this.TEST) {
      console.error("macros.critical called");
      console.error(
        "Consider using the VERBOSE env flag for more info",
        ...args
      );
    } else {
      this.error(...args);
      process.exit(1);
    }
  }

  // Use this for stuff that is bad, and shouldn't happen, but isn't mission critical and can be ignored and the app will continue working
  // Will log something to rollbar and rollbar will send off an email

  // We ignore the 'any' error, since console.log/warn/error all take the 'any' type
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  warn(...args: any): void {
    this.logger.warn(args);

    if (LogLevel.WARN > this.logLevel) {
      return;
    }

    if (process.env.NODE_ENV !== "test") {
      const allArgs = ["Warning:"].concat(args);
      const formattedArgs = allArgs.map((a) =>
        typeof a === "string" ? a.yellow.underline : a
      );
      console.warn(...formattedArgs);
    }

    if (this.PROD) {
      this.logRollbarError(args, false);
    }
  }

  // Use this for stuff that should never happen, but does not mean the program cannot continue.
  // This will continue running in dev, but will exit on CI
  // Will log stack trace and cause CI to fail,  so CI will send an email

  // We ignore the 'any' error, since console.log/warn/error all take the 'any' type
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  error(...args: any): void {
    this.logger.error(args);

    if (!this.TEST) {
      const allArgs = [
        "Check the /logs directory for more detailed logging",
        ...args,
      ];
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      const fullArgs: string[] = allArgs.map((a: any) =>
        util.inspect(a, false, null, !this.PROD)
      );

      console.error("Error: ", ...fullArgs); // eslint-disable-line no-console
      console.trace(); // eslint-disable-line no-console
    }

    if (this.PROD) {
      // If running on Travis, just exit 1 and travis will send off an email.
      if (process.env.CI) {
        process.exit(1);

        // If running on AWS, tell rollbar about the error so rollbar sends off an email.
      } else {
        this.logRollbarError(args, false);
      }
    }
  }

  // Use this for normal logging
  // Will log as normal, but stays silent during testing

  // We ignore the 'any' error, since console.log/warn/error all take the 'any' type
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  log(...args: any): void {
    this.logger.info(args);

    if (LogLevel.INFO > this.logLevel) {
      return;
    }

    console.log(...args);
  }

  http(...args: any): void {
    this.logger.http(args);

    if (LogLevel.HTTP > this.logLevel) {
      return;
    }

    console.log(...args);
  }

  // Use console.warn to log stuff during testing
  // We ignore the 'any' error, since console.log/warn/error all take the 'any' type
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  verbose(...args: any): void {
    this.logger.verbose(args);

    if (LogLevel.VERBOSE > this.logLevel) {
      return;
    }

    console.log(...args);
  }

  // https://stackoverflow.com/questions/18082/validate-decimal-numbers-in-javascript-isnumeric
  isNumeric(n: string): boolean {
    return (
      !Number.isNaN(Number.parseFloat(n)) && Number.isFinite(Number.parseInt(n))
    );
  }
}

const macrosInstance = new Macros();

macrosInstance.log(
  `**** Starting using log level: ${macrosInstance.logLevel} (${
    LogLevel[macrosInstance.logLevel]
  })`
);
macrosInstance.log(
  "**** Change the log level using the 'LOG_LEVEL' environment variable"
);

export default macrosInstance;
