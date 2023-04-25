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

// Collection of small functions that are used in many different places in the backend.
// This includes things related to saving and loading the dev data, parsing specific fields from pages and more.
// Would be ok with splitting up this file into separate files (eg, one for stuff related to scraping and another one for other stuff) if this file gets too big.

// We should be in the directory with package.json
const main_dir = path.join(__dirname, "..");
process.chdir(main_dir);

try {
  fs.statSync("package.json");
} catch (_e) {
  throw new Error(
    "The macros file seems to have moved relative to the base directory; please update the path."
  );
}

// This is the JSON object saved in /etc/searchneu/config.json
// null = hasen't been loaded yet.
// {} = it has been loaded, but nothing was found or the file doesn't exist or the file was {}
// {...} = the file
let envVariables = null;

export enum EnvLevel {
  PROD,
  TEST,
  DEV,
}

export enum LogLevel {
  CRITICAL = -1,
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  HTTP = 3,
  VERBOSE = 4,
}

export function getLogLevel(input: string): LogLevel {
  input = input ? input.toUpperCase().trim() : "";
  return LogLevel[input as keyof typeof LogLevel] || LogLevel.INFO;
}

export function getEnvLevel(): EnvLevel {
  const nodeEnv = process.env.NODE_ENV;

  const isProdCI = process.env.CI && nodeEnv !== "test" && nodeEnv !== "dev";
  const isProd = process.env.PROD || nodeEnv === "prod" || isProdCI;
  const isDev = process.env.DEV || nodeEnv === "dev";
  const isTest = process.env.TEST || nodeEnv === "test";

  if (isProd) {
    return EnvLevel.PROD;
  } else if (isDev) {
    return EnvLevel.DEV;
  } else if (isTest) {
    return EnvLevel.TEST;
  } else {
    console.log(`Unknown env! (${nodeEnv}) Setting to dev.`); // eslint-disable-line no-console
    return EnvLevel.DEV;
  }
}

class Macros {
  // Version of the schema for the data. Any changes in this schema will affect the data saved in the dev_data folder
  // and the data saved in the term dumps in the public folder and the search indexes in the public folder.
  // Increment this number every time there is a breaking change in the schema.
  // The first schema change is here: https://github.com/ryanhugh/searchneu/pull/48
  readonly schemaVersion = 2;
  readonly PUBLIC_DIR = path.join("public", "data", `v${this.schemaVersion}`);
  readonly DEV_DATA_DIR = path.join("dev_data", `v${this.schemaVersion}`);

  // Folder of the raw html cache for the requests.
  readonly REQUESTS_CACHE_DIR = "requests";

  readonly dirname: string;
  logLevel: LogLevel;
  private amplitude: Amplitude;
  private rollbar: Rollbar | null;
  private logger: Logger;

  envLevel: EnvLevel;
  PROD: boolean;
  TEST: boolean;
  DEV: boolean;

  constructor() {
    this.logLevel = getLogLevel(process.env.LOG_LEVEL);

    this.envLevel = getEnvLevel();
    console.log(`Running in ${EnvLevel[this.envLevel]}`); // eslint-disable-line no-console
    this.PROD = this.envLevel === EnvLevel.PROD;
    this.TEST = this.envLevel === EnvLevel.TEST;
    this.DEV = this.envLevel === EnvLevel.DEV;

    // This is the same token in the frontend and the backend, and does not need to be kept private.
    this.amplitude = new Amplitude("e0801e33a10c3b66a3c1ac8ebff53359");

    this.rollbar =
      this.PROD &&
      new Rollbar({
        accessToken: this.getEnvVariable("rollbarPostServerItemToken"),
        captureUncaught: true,
        captureUnhandledRejections: true,
      });

    this.dirname = path.join("logs", this.PROD ? "prod" : "dev");

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

    return this.amplitude.track(data).catch((error) => {
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
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  logRollbarError(args: any, shouldExit: boolean): void {
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
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  critical(...args: any): void {
    this.logger.error(args);

    if (this.TEST) {
      console.error("macros.critical called");
      this.error(...args);
    } else {
      this.error(...args);
      process.exit(1);
    }
  }

  // Use this for stuff that should never happen, but does not mean the program cannot continue.
  // This will continue running in dev, but will exit on CI
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  error(...args: any): void {
    this.logger.error(args);

    if (!this.TEST) {
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      const fullArgs: string[] = args.map((a: any) =>
        util.inspect(a, false, null, !this.PROD)
      );

      console.error("Check the /logs directory for more detail: ", ...fullArgs); // eslint-disable-line no-console
    }

    if (this.PROD) {
      // If running on Travis, just exit 1 and travis will send off an email.
      if (process.env.CI) {
        process.exit(1);
      } else {
        // If running on AWS, tell rollbar about the error so rollbar sends off an email.
        this.logRollbarError(args, false);
      }
    }
  }

  // Use this for stuff that is bad, and shouldn't happen, but isn't mission critical and can be ignored and the app will continue working
  // Will log something to rollbar and rollbar will send off an email
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  warn(...args: any): void {
    this.logger.warn(args);

    if (LogLevel.WARN > this.logLevel) {
      return;
    }

    if (!this.TEST) {
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      const formattedArgs = args.map((a: any) =>
        typeof a === "string" ? a.yellow.underline : a
      );
      console.warn("Warning:", ...formattedArgs);
    }

    if (this.PROD) {
      this.logRollbarError(args, false);
    }
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  log(...args: any): void {
    this.logger.info(args);

    if (LogLevel.INFO > this.logLevel) {
      return;
    }

    console.log(...args);
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  http(...args: any): void {
    this.logger.http(args);

    if (LogLevel.HTTP > this.logLevel) {
      return;
    }

    console.log(...args);
  }

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
