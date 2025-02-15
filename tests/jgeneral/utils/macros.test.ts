/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import macros, {
  LogLevel,
  getLogLevel,
  EnvLevel,
  getEnvLevel,
} from "../../../utils/macros";

afterEach(() => {
  jest.clearAllMocks();
});

it("logAmplitudeEvent should not crash", () => {
  macros.logAmplitudeEvent("event_from_testing", {
    hostname: "3",
  });
});

describe("getLogLevel", () => {
  it("using existing keys", () => {
    expect(getLogLevel("verbose")).toBe(LogLevel.VERBOSE);
    expect(getLogLevel("verbose ")).toBe(LogLevel.VERBOSE);
    expect(getLogLevel(" VERBOSE")).toBe(LogLevel.VERBOSE);
  });

  it("default value", () => {
    expect(getLogLevel(null)).toBe(LogLevel.INFO);
    expect(getLogLevel("SdfsdfsdfSD")).toBe(LogLevel.INFO);
    expect(getLogLevel(Number.MAX_SAFE_INTEGER.toString())).toBe(LogLevel.INFO);
  });
});

describe("getEngLevel", () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...env,
      PROD: null,
      NODE_ENV: null,
      CI: null,
      DEV: null,
      TEST: null,
    };
  });

  afterEach(() => {
    process.env = env;
  });

  it("production CI", () => {
    process.env.CI = "true";
    process.env.NODE_ENV = "not test and not dev";
    expect(getEnvLevel()).toBe(EnvLevel.PROD);
    process.env.NODE_ENV = "test";
    expect(getEnvLevel()).not.toBe(EnvLevel.PROD);
    process.env.NODE_ENV = "dev";
    expect(getEnvLevel()).not.toBe(EnvLevel.PROD);
  });

  it("is a production env", () => {
    process.env.CI = null;
    process.env.TEST = "true";
    process.env.PROD = "true";
    expect(getEnvLevel()).toBe(EnvLevel.PROD);
    process.env.PROD = null;
    expect(getEnvLevel()).not.toBe(EnvLevel.PROD);
    process.env.NODE_ENV = "prod";
    expect(getEnvLevel()).toBe(EnvLevel.PROD);
  });

  it("is a dev env", () => {
    process.env.DEV = "true";
    expect(getEnvLevel()).toBe(EnvLevel.DEV);
    process.env.DEV = null;
    process.env.TEST = "true";
    expect(getEnvLevel()).not.toBe(EnvLevel.DEV);
    process.env.NODE_ENV = "dev";
    expect(getEnvLevel()).toBe(EnvLevel.DEV);
  });

  it("is a test env", () => {
    process.env.TEST = "true";
    expect(getEnvLevel()).toBe(EnvLevel.TEST);
  });

  it("defaults to a dev env", () => {
    expect(getEnvLevel()).toBe(EnvLevel.DEV);
  });
});

it("env variables don't re-fetch if already fetched once", () => {
  const envKey = "fake_key";
  macros.getAllEnvVariables();
  process.env[envKey] = "here";
  expect(macros.getAllEnvVariables()[envKey]).toBeUndefined();
});

describe("logAmplitudeEvent", () => {
  it("not prod", async () => {
    macros.PROD = false;
    expect(await macros.logAmplitudeEvent("", { hostname: "" })).toBeNull();
  });

  it("tracking call", async () => {
    macros.PROD = true;
    const prevTrackFn = macros["amplitude"].track;
    macros["amplitude"].track = jest.fn().mockImplementationOnce(() => {
      return {
        catch: () => {
          // do nothing @typescript-eslint/no-empty-function
        },
      };
    });
    const prevWarn = macros.warn;
    macros.warn = jest.fn().mockImplementation(() => {
      // do nothing @typescript-eslint/no-empty-function
    });
    Date.now = jest.fn(() => 1);

    await macros.logAmplitudeEvent("type", { hostname: "host" });
    expect(macros["amplitude"].track).toHaveBeenCalledWith({
      event_type: "type",
      device_id: "Backend type",
      session_id: Date.now(),
      event_properties: {
        hostname: "host",
      },
    });

    macros["amplitude"].track = prevTrackFn;
    macros.warn = prevWarn;
    macros.PROD = false;
    jest.resetAllMocks();
  });
});

describe("utility functions", () => {
  it("isNumeric", () => {
    expect(macros.isNumeric("this is not a number")).toBeFalsy();
    expect(macros.isNumeric(Number.NaN.toString())).toBeFalsy();
    expect(macros.isNumeric("three")).toBeFalsy();
    expect(macros.isNumeric("asd24sdf./,sdfsd32_1!21we")).toBeFalsy();
    expect(macros.isNumeric("$12")).toBeFalsy();
    expect(macros.isNumeric("💙💛🚧🚧😊🎁👏⚠")).toBeFalsy();

    expect(macros.isNumeric("2")).toBeTruthy();
    expect(macros.isNumeric("-23")).toBeTruthy();
    expect(macros.isNumeric("2.3141")).toBeTruthy();
    expect(macros.isNumeric("43_122")).toBeTruthy();
    expect(macros.isNumeric(Number.MAX_SAFE_INTEGER.toString())).toBeTruthy();
  });
});

describe("console statements", () => {
  it("verbose", () => {
    console.log = jest.fn();
    // It doesn't log unless the LogLevel is verbose
    macros.logLevel = LogLevel.CRITICAL;
    macros.verbose("test");

    macros.logLevel = LogLevel.ERROR;
    macros.verbose("test");

    macros.logLevel = LogLevel.WARN;
    macros.verbose("test");

    macros.logLevel = LogLevel.INFO;
    macros.verbose("test");

    macros.logLevel = LogLevel.HTTP;
    macros.verbose("test");

    expect(console.log).toHaveBeenCalledTimes(0);
    macros.logLevel = LogLevel.VERBOSE;
    macros.verbose("test");
    expect(console.log).toHaveBeenCalledWith("test");

    macros.verbose("call", 3, { test: "test" });
    expect(console.log).toHaveBeenCalledWith("call", 3, { test: "test" });
  });

  it("http", () => {
    console.log = jest.fn();
    // It doesn't log unless the LogLevel is HTTP or above
    macros.logLevel = LogLevel.CRITICAL;
    macros.http("test");

    macros.logLevel = LogLevel.ERROR;
    macros.http("test");

    macros.logLevel = LogLevel.WARN;
    macros.http("test");

    macros.logLevel = LogLevel.INFO;
    macros.http("test");
    expect(console.log).toHaveBeenCalledTimes(0);

    macros.logLevel = LogLevel.HTTP;
    macros.http("hello");
    expect(console.log).toHaveBeenCalledWith("hello");

    macros.logLevel = LogLevel.VERBOSE;
    macros.http("test");
    expect(console.log).toHaveBeenCalledWith("test");

    macros.http("varied types", 3, { test: "test" });
    expect(console.log).toHaveBeenCalledWith("varied types", 3, {
      test: "test",
    });
  });

  it("log", () => {
    console.log = jest.fn();
    // It doesn't log unless the LogLevel is LOG or above
    macros.logLevel = LogLevel.CRITICAL;
    macros.log("test");

    macros.logLevel = LogLevel.ERROR;
    macros.log("test");

    macros.logLevel = LogLevel.WARN;
    macros.log("test");
    expect(console.log).toHaveBeenCalledTimes(0);

    macros.logLevel = LogLevel.INFO;
    macros.log("hello");
    expect(console.log).toHaveBeenCalledWith("hello");

    macros.logLevel = LogLevel.HTTP;
    macros.log("hello2");
    expect(console.log).toHaveBeenCalledWith("hello2");

    macros.logLevel = LogLevel.VERBOSE;
    macros.log("test");
    expect(console.log).toHaveBeenCalledWith("test");
  });

  describe("warn", () => {
    it("basic testing", () => {
      macros.TEST = false;
      console.warn = jest.fn();
      // It doesn't log unless the LogLevel is WARN or above
      macros.logLevel = LogLevel.CRITICAL;
      macros.warn("test");

      macros.logLevel = LogLevel.ERROR;
      macros.warn("test");
      expect(console.warn).toHaveBeenCalledTimes(0);

      macros.logLevel = LogLevel.WARN;
      macros.warn("hello4");
      expect(console.warn).toHaveBeenCalledWith(
        "Warning:",
        "hello4".yellow.underline,
      );

      macros.logLevel = LogLevel.INFO;
      macros.warn("hello");
      expect(console.warn).toHaveBeenCalledWith(
        "Warning:",
        "hello".yellow.underline,
      );

      macros.logLevel = LogLevel.HTTP;
      macros.warn("hello2");
      expect(console.warn).toHaveBeenCalledWith(
        "Warning:",
        "hello2".yellow.underline,
      );

      macros.logLevel = LogLevel.VERBOSE;
      macros.warn("test");
      expect(console.warn).toHaveBeenCalledWith(
        "Warning:",
        "test".yellow.underline,
      );
    });

    it("warn doesn't log in a test env", () => {
      macros.TEST = true;
      macros.logLevel = LogLevel.WARN;
      console.warn = jest.fn();
      macros.warn("hello4");
      expect(console.warn).toHaveBeenCalledTimes(0);
    });

    it("warn sends a rollbar error in Prod", () => {
      macros.PROD = true;
      macros.logRollbarError = jest.fn();
      macros.warn("x");
      expect(macros.logRollbarError).toBeCalledWith(["x"], false);
    });
  });

  describe("error", () => {
    const env = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...env };
    });

    afterEach(() => {
      process.env = env;
      process.env.CI = null;
    });

    it("basic testing", () => {
      macros.TEST = false;
      console.error = jest.fn();
      macros.logLevel = LogLevel.CRITICAL;
      process.env.CI = null;
      macros.error("test");
      expect(console.error).toHaveBeenCalledWith(
        "Check the /logs directory for more detail: ",
        "'test'",
      );

      macros.logLevel = LogLevel.ERROR;
      macros.error("test");
      macros.logLevel = LogLevel.WARN;
      macros.error("hello4");
      macros.logLevel = LogLevel.INFO;
      macros.error("hello");
      macros.logLevel = LogLevel.HTTP;
      macros.error("hello2");
      macros.logLevel = LogLevel.VERBOSE;
      macros.error("test");

      // Called twice per macros.error call
      expect(console.error).toHaveBeenCalledTimes(6);
    });

    it("doesn't log in test", () => {
      process.env.CI = null;
      macros.TEST = true;
      console.error = jest.fn();
      macros.error("test");
      expect(console.error).toHaveBeenCalledTimes(0);
    });

    it("logging in PROD, not CI", () => {
      macros.PROD = true;
      process.env.CI = null;

      macros.logRollbarError = jest.fn();
      macros.error("x");
      expect(macros.logRollbarError).toHaveBeenCalledWith(["x"], false);
    });

    it("logging in PROD and CI", () => {
      macros.PROD = true;
      process.env.CI = "true";
      // @ts-expect-error -- Don't care about this error
      const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {
        // do nothing @typescript-eslint/no-empty-function
      });

      macros.error("x");
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });

  describe("critical", () => {
    const env = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...env };
    });

    afterEach(() => {
      process.env = env;
    });

    it("not in test", () => {
      macros.TEST = false;
      process.env.CI = null;
      console.error = jest.fn();
      // @ts-expect-error -- Don't care about this error
      const mockExit = jest.spyOn(process, "exit").mockImplementation(() => {
        // do nothing @typescript-eslint/no-empty-function
      });

      macros.logLevel = LogLevel.CRITICAL;
      macros.critical("test");
      macros.logLevel = LogLevel.ERROR;
      macros.critical("test");
      macros.logLevel = LogLevel.WARN;
      macros.critical("hello4");
      macros.logLevel = LogLevel.INFO;
      macros.critical("hello");
      macros.logLevel = LogLevel.HTTP;
      macros.critical("hello2");
      macros.logLevel = LogLevel.VERBOSE;
      macros.critical("test");

      expect(console.error).toHaveBeenCalledTimes(6);
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });

    it("not in test", () => {
      macros.TEST = true;
      process.env.CI = null;
      console.error = jest.fn();

      macros.logLevel = LogLevel.CRITICAL;
      macros.critical("test");
      macros.logLevel = LogLevel.ERROR;
      macros.critical("test");
      macros.logLevel = LogLevel.WARN;
      macros.critical("hello4");
      macros.logLevel = LogLevel.INFO;
      macros.critical("hello");
      macros.logLevel = LogLevel.HTTP;
      macros.critical("hello2");
      macros.logLevel = LogLevel.VERBOSE;
      macros.critical("test");

      // Called once per macros.critical call (when in test)
      expect(console.error).toHaveBeenCalledTimes(6);
    });
  });
});
