/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import macros, { LogLevel } from "../../../utils/macros";

it("logAmplitudeEvent should not crash", () => {
  macros.logAmplitudeEvent("event_from_testing", {
    hostname: "3",
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
        "hello4".yellow.underline
      );

      macros.logLevel = LogLevel.INFO;
      macros.warn("hello");
      expect(console.warn).toHaveBeenCalledWith(
        "Warning:",
        "hello".yellow.underline
      );

      macros.logLevel = LogLevel.HTTP;
      macros.warn("hello2");
      expect(console.warn).toHaveBeenCalledWith(
        "Warning:",
        "hello2".yellow.underline
      );

      macros.logLevel = LogLevel.VERBOSE;
      macros.warn("test");
      expect(console.warn).toHaveBeenCalledWith(
        "Warning:",
        "test".yellow.underline
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
    });

    it("basic testing", () => {
      macros.TEST = false;
      console.error = jest.fn();
      macros.logLevel = LogLevel.CRITICAL;
      macros.error("test");
      expect(console.error).toHaveBeenCalledWith(
        "Check the /logs directory for more detail: ",
        "'test'"
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
      expect(console.error).toHaveBeenCalledTimes(12);
    });

    it("doesn't log in test", () => {
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

      // Called twice per macros.error call
      expect(console.error).toHaveBeenCalledTimes(12);
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
