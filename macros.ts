/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import path from 'path';
import fs from 'fs-extra';
import Rollbar, { MaybeError } from 'rollbar';
import Amplitude from 'amplitude';

import moment from 'moment';
import commonMacros from './abstractMacros';

const amplitude = new Amplitude(commonMacros.amplitudeToken);

// Collection of small functions that are used in many different places in the backend.
// This includes things related to saving and loading the dev data, parsing specific fields from pages and more.
// Would be ok with splitting up this file into separate files (eg, one for stuff related to scraping and another one for other stuff) if this file gets too big.
// Stuff in this file can be specific to the backend and will only be ran in the backend.
// If it needs to be ran in both the backend and the frontend, move it to the common macros file :P

// TODO: improve getBaseHost by using a list of top level domains. (public on the internet)

// Change the current working directory to the directory with package.json and .git folder.
const originalCwd: string = process.cwd();
let oldcwd: string;
while (1) {
  try {
    fs.statSync('package.json');
  } catch (e) {
    oldcwd = process.cwd();
    //cd .. until in the same dir as package.json, the root of the project
    process.chdir('..');

    // Prevent an infinate loop: If we keep cd'ing upward and we hit the root dir and still haven't found
    // a package.json, just return to the original directory and break out of this loop.
    if (oldcwd === process.cwd()) {
      commonMacros.warn(
        "Can't find directory with package.json, returning to",
        originalCwd,
      );
      process.chdir(originalCwd);
      break;
    }

    continue;
  }
  break;
}

type EnvKeys =
  | 'elasticURLv2'
  | 'dbName'
  | 'dbHost'
  // Secrets:
  | 'dbUsername'
  | 'dbPassword'
  | 'rollbarPostServerItemToken'
  | 'fbToken'
  | 'fbVerifyToken'
  | 'fbAppSecret'
  // Only for dev:
  | 'fbMessengerId';

type EnvVars = Partial<Record<EnvKeys, string>>;

// This is the JSON object saved in /etc/searchneu/config.json
// null = hasen't been loaded yet.
// {} = it has been loaded, but nothing was found or the file doesn't exist or the file was {}
// {...} = the file
let envVariables: EnvVars = null;

class Macros extends commonMacros {
  // Version of the schema for the data. Any changes in this schema will effect the data saved in the dev_data folder
  // and the data saved in the term dumps in the public folder and the search indexes in the public folder.
  // Increment this number every time there is a breaking change in the schema.
  // This will cause the data to be saved in a different folder in the public data folder.
  // The first schema change is here: https://github.com/ryanhugh/searchneu/pull/48
  static schemaVersion = 2;

  static PUBLIC_DIR = path.join('public', 'data', `v${Macros.schemaVersion}`);

  static DEV_DATA_DIR = path.join('dev_data', `v${Macros.schemaVersion}`);

  // Folder of the raw html cache for the requests.
  static REQUESTS_CACHE_DIR = 'requests';

  // For iterating over every letter in a couple different places in the code.
  static ALPHABET = 'maqwertyuiopsdfghjklzxcvbn';

  private static rollbar: Rollbar =
  Macros.PROD
    && new Rollbar({
      accessToken: Macros.getEnvVariable('rollbarPostServerItemToken'),
      captureUncaught: true,
      captureUnhandledRejections: true,
    });

  static getAllEnvVariables(): EnvVars {
    if (envVariables) {
      return envVariables;
    }

    let configFileName = '/etc/searchneu/config.json';

    // Yes, this is syncronous instead of the normal Node.js async style
    // But keeping it sync helps simplify other parts of the code
    // and it only takes 0.2 ms on my Mac.

    let exists = fs.existsSync(configFileName);

    // Also check /mnt/c/etc... in case we are running inside WSL.
    if (!exists) {
      configFileName = '/mnt/c/etc/searchneu/config.json';
      exists = fs.existsSync(configFileName);
    }

    if (!exists) {
      envVariables = {};
    } else {
      envVariables = JSON.parse(fs.readFileSync(configFileName));
    }

    envVariables = Object.assign(envVariables, process.env);

    return envVariables;
  }

  // Gets the current time, just used for logging
  static getTime() {
    return moment().format('hh:mm:ss a');
  }

  static getEnvVariable(name: EnvKeys): string {
    return this.getAllEnvVariables()[name];
  }

  // Log an event to amplitude. Same function signature as the function for the frontend.
  static async logAmplitudeEvent(type: string, event: any) {
    if (!Macros.PROD) {
      return null;
    }

    const data = {
      event_type: type,
      device_id: `Backend ${type}`,
      session_id: Date.now(),
      event_properties: event,
    };

    return amplitude.track(data).catch((error) => {
      Macros.warn('error Logging amplitude event failed:', error);
    });
  }

  static getRollbar() {
    if (Macros.PROD && !this.rollbar) {
      console.error("Don't have rollbar so not logging error in prod?"); // eslint-disable-line no-console
    }

    return this.rollbar;
  }

  // Takes an array of a bunch of thigs to log to rollbar
  // Any of the times in the args array can be an error, and it will be logs according to rollbar's API
  // shouldExit - exit after logging.
  static async logRollbarError(args: any, shouldExit: boolean) {
    // Don't log rollbar stuff outside of Prod
    if (!Macros.PROD) {
      return;
    }

    const stack = new Error().stack;

    // The middle object can include any properties and values, much like amplitude.
    args.stack = stack;

    // Search through the args array for an error. If one is found, log that separately.
    let possibleError: MaybeError;

    for (const value of Object.values(args)) {
      if (value instanceof Error) {
        possibleError = value;
        break;
      }
    }
    // eslint-disable-next-line no-console
    console.log('sending to rollbar', possibleError, args);

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
  static critical(...args: any) {
    if (Macros.TEST) {
      console.error('macros.critical called'); // eslint-disable-line no-console
      console.error(...args); // eslint-disable-line no-console
    } else {
      Macros.error(...args);
      process.exit(1);
    }
  }

  // Use this for stuff that is bad, and shouldn't happen, but isn't mission critical and can be ignored and the app will continue working
  // Will log something to rollbar and rollbar will send off an email
  static async warn(...args: any) {
    super.warn(...args);

    if (Macros.PROD) {
      this.logRollbarError(args, false);
    }
  }

  // Use this for stuff that should never happen, but does not mean the program cannot continue.
  // This will continue running in dev, but will exit on CI
  // Will log stack trace
  // and cause CI to fail
  // so CI will send an email
  static async error(...args: any) {
    super.error(...args);

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

  // Use console.warn to log stuff during testing
  static verbose(...args: any) {
    if (!process.env.VERBOSE) {
      return;
    }

    console.log(...args); // eslint-disable-line no-console
  }
}

Macros.verbose('Starting in verbose mode.');

export default Macros;
