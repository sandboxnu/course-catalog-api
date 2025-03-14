import path from "path";
import fs from "fs-extra";
import dotenv from "dotenv";
import "colors";
import logger from "./logger";

dotenv.config();

// Collection of small functions that are used in many different places in the backend.
// This includes things related to saving and loading the dev data, parsing specific fields from pages and more.
// Would be ok with splitting up this file into separate files (eg, one for stuff related to scraping and another one for other stuff) if this file gets too big.

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

  envLevel: EnvLevel;
  PROD: boolean;
  TEST: boolean;
  DEV: boolean;

  constructor() {
    this.envLevel = getEnvLevel();
    this.PROD = this.envLevel === EnvLevel.PROD;
    this.TEST = this.envLevel === EnvLevel.TEST;
    this.DEV = this.envLevel === EnvLevel.DEV;
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

  // DEPRECATED: Please do not use these logging calls! Instead use the raw
  // winston logger
  critical(...args: any): void {
    logger.error(args);
    logger.verbose("using deprecated logger. please switch to winston logger");

    process.exit(1);
  }

  error(...args: any): void {
    logger.error(args);
    logger.verbose("using deprecated logger. please switch to winston logger");

    if (this.PROD) {
      if (process.env.CI) {
        process.exit(1);
      }
    }
  }

  warn(...args: any): void {
    logger.warn(args);
    logger.verbose("using deprecated logger. please switch to winston logger");
  }

  log(...args: any): void {
    logger.info(args);
    logger.verbose("using deprecated logger. please switch to winston logger");
  }

  http(...args: any): void {
    logger.http(args);
    logger.verbose("using deprecated logger. please switch to winston logger");
  }

  verbose(...args: any): void {
    logger.verbose(args);
    logger.verbose("using deprecated logger. please switch to winston logger");
  }

  // https://stackoverflow.com/questions/18082/validate-decimal-numbers-in-javascript-isnumeric
  isNumeric(n: string): boolean {
    return (
      !Number.isNaN(Number.parseFloat(n)) && Number.isFinite(Number.parseInt(n))
    );
  }
}

const macrosInstance = new Macros();
export default macrosInstance;
