/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import {
  suite,
  test,
  mock,
  beforeEach,
  before,
  afterEach,
  type TestContext,
} from "node:test";
import macros, {
  getEnvLevel,
  getLogLevel,
  LogLevel,
  EnvLevel,
} from "../../utils/macros";

test("logging things work", () => {
  macros.warn();
  macros.verbose();
  macros.error("fjdaj");
});

test("some other stuff doesnt crash", () => {
  macros.logAmplitudeEvent("test event", { hi: 4 } as any);
});

test("logAmplitudeEvent should not crash", () => {
  macros.logAmplitudeEvent("event_from_testing", { a: 3 } as any);
});

suite("getLogLevel", () => {
  test("using existing keys", (t: TestContext) => {
    t.assert.strictEqual(getLogLevel("verbose"), LogLevel.VERBOSE);
    t.assert.strictEqual(getLogLevel("verbose "), LogLevel.VERBOSE);
    t.assert.strictEqual(getLogLevel(" VERBOSE "), LogLevel.VERBOSE);
  });

  test("default value", (t: TestContext) => {
    t.assert.strictEqual(getLogLevel(""), LogLevel.INFO);
    t.assert.strictEqual(getLogLevel("SdfsdfsdfSD"), LogLevel.INFO);
    t.assert.strictEqual(
      getLogLevel(Number.MAX_SAFE_INTEGER.toString()),
      LogLevel.INFO,
    );
  });
});

suite("getEngLevel", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = {
      ...env,
      PROD: undefined,
      NODE_ENV: undefined,
      CI: undefined,
      DEV: undefined,
      TEST: undefined,
    };
  });

  afterEach(() => {
    process.env = env;
  });

  test("production CI", (t: TestContext) => {
    process.env.CI = "true";
    process.env.NODE_ENV = "not test and not dev";
    t.assert.strictEqual(getEnvLevel(), EnvLevel.PROD);
    process.env.NODE_ENV = "test";
    t.assert.notStrictEqual(getEnvLevel(), EnvLevel.PROD);
    process.env.NODE_ENV = "dev";
    t.assert.notStrictEqual(getEnvLevel(), EnvLevel.PROD);
  });

  test("is a production env", (t: TestContext) => {
    process.env.CI = undefined;
    process.env.TEST = "true";
    process.env.PROD = "true";
    t.assert.strictEqual(getEnvLevel(), EnvLevel.PROD);
    process.env.PROD = undefined;
    t.assert.notStrictEqual(getEnvLevel(), EnvLevel.PROD);
    process.env.NODE_ENV = "prod";
    t.assert.strictEqual(getEnvLevel(), EnvLevel.PROD);
  });

  test("is a dev env", (t: TestContext) => {
    process.env.DEV = "true";
    t.assert.strictEqual(getEnvLevel(), EnvLevel.DEV);
    process.env.DEV = undefined;
    process.env.TEST = "true";
    t.assert.notStrictEqual(getEnvLevel(), EnvLevel.DEV);
    process.env.NODE_ENV = "dev";
    t.assert.strictEqual(getEnvLevel(), EnvLevel.DEV);
  });

  test("is a test env", (t: TestContext) => {
    process.env.TEST = "true";
    t.assert.strictEqual(getEnvLevel(), EnvLevel.TEST);
  });

  test("defaults to a dev env", (t: TestContext) => {
    t.assert.strictEqual(getEnvLevel(), EnvLevel.DEV);
  });
});

test("env variables don't re-fetch if already fetched once", (t: TestContext) => {
  const envKey = "fake_key";
  macros.getAllEnvVariables();
  process.env[envKey] = "here";
  t.assert.strictEqual(macros.getAllEnvVariables()[envKey], undefined);
});

suite("logAmplitudeEvent", () => {
  test("not prod", async (t: TestContext) => {
    macros.PROD = false;
    t.assert.strictEqual(
      await macros.logAmplitudeEvent("", { hostname: "" }),
      null,
    );
  });

  test("tracking call", async (t: TestContext) => {
    macros.PROD = true;
    const ampMock = t.mock.method(macros["amplitude"], "track", () => ({
      catch: () => {},
    }));

    t.mock.method(macros, "warn", () => {});
    t.mock.method(Date, "now", () => 1);

    await macros.logAmplitudeEvent("type", { hostname: "host" });
    t.assert.deepStrictEqual(ampMock.mock.calls[0].arguments[0], {
      event_type: "type",
      device_id: "Backend type",
      session_id: Date.now(),
      event_properties: {
        hostname: "host",
      },
    });
  });
});

suite("utility functions", () => {
  test("isNumeric should return false for non-numeric strings", (t: TestContext) => {
    t.assert.strictEqual(macros.isNumeric("this is not a number"), false);
    t.assert.strictEqual(macros.isNumeric(Number.NaN.toString()), false);
    t.assert.strictEqual(macros.isNumeric("three"), false);
    t.assert.strictEqual(macros.isNumeric("asd24sdf./,sdfsd32_1!21we"), false);
    t.assert.strictEqual(macros.isNumeric("$12"), false);
    t.assert.strictEqual(macros.isNumeric("💙💛🚧🚧😊🎁👏⚠"), false);
  });

  test("isNumeric should return true for numeric strings", (t: TestContext) => {
    t.assert.strictEqual(macros.isNumeric("2"), true);
    t.assert.strictEqual(macros.isNumeric("-23"), true);
    t.assert.strictEqual(macros.isNumeric("2.3141"), true);
    t.assert.strictEqual(macros.isNumeric("43_122"), true);
    t.assert.strictEqual(
      macros.isNumeric(Number.MAX_SAFE_INTEGER.toString()),
      true,
    );
  });
});

suite("console statements", () => {
  test("verbose", (t: TestContext) => {
    t.mock.method(console, "log", () => {});
    // It doesn't log unless the LogLevel is verbose
    macros.logLevel = LogLevel.CRITICAL;
    const consoleMock = t.mock.method(console, "log", () => {});
    macros.verbose("test");

    macros.logLevel = LogLevel.ERROR;
    macros.verbose("test");

    macros.logLevel = LogLevel.WARN;
    macros.verbose("test");

    macros.logLevel = LogLevel.INFO;
    macros.verbose("test");

    macros.logLevel = LogLevel.HTTP;
    macros.verbose("test");

    t.assert.strictEqual(consoleMock.mock.callCount(), 0);

    macros.logLevel = LogLevel.VERBOSE;
    macros.verbose("test");
    t.assert.strictEqual(consoleMock.mock.calls[0].arguments[0], "test");

    macros.verbose("call", 3, { test: "test" });
    t.assert.deepEqual(consoleMock.mock.calls[1].arguments, [
      "call",
      3,
      { test: "test" },
    ]);
  });

  test("http", (t: TestContext) => {
    const consoleMock = t.mock.method(console, "log", () => {});
    // It doesn't log unless the LogLevel is HTTP or above
    macros.logLevel = LogLevel.CRITICAL;
    macros.http("test");

    macros.logLevel = LogLevel.ERROR;
    macros.http("test");

    macros.logLevel = LogLevel.WARN;
    macros.http("test");

    macros.logLevel = LogLevel.INFO;
    macros.http("test");
    t.assert.strictEqual(consoleMock.mock.callCount(), 0);

    macros.logLevel = LogLevel.HTTP;
    macros.http("hello");
    t.assert.strictEqual(consoleMock.mock.calls[0].arguments[0], "hello");

    macros.logLevel = LogLevel.VERBOSE;
    macros.http("test");
    t.assert.strictEqual(consoleMock.mock.calls[1].arguments[0], "test");

    macros.http("varied types", 3, { test: "test" });
    t.assert.deepStrictEqual(consoleMock.mock.calls[2].arguments, [
      "varied types",
      3,
      { test: "test" },
    ]);
  });

  test("log", (t: TestContext) => {
    const consoleMock = t.mock.method(console, "log", () => {});
    // It doesn't log unless the LogLevel is LOG or above
    macros.logLevel = LogLevel.CRITICAL;
    macros.log("test");

    macros.logLevel = LogLevel.ERROR;
    macros.log("test");

    macros.logLevel = LogLevel.WARN;
    macros.log("test");
    t.assert.strictEqual(consoleMock.mock.callCount(), 0);

    macros.logLevel = LogLevel.INFO;
    macros.log("hello");
    t.assert.strictEqual(consoleMock.mock.calls[0].arguments[0], "hello");

    macros.logLevel = LogLevel.HTTP;
    macros.log("hello2");
    t.assert.strictEqual(consoleMock.mock.calls[1].arguments[0], "hello2");

    macros.logLevel = LogLevel.VERBOSE;
    macros.log("test");
    t.assert.strictEqual(consoleMock.mock.calls[2].arguments[0], "test");
  });

  suite("warn", (s) => {
    before(() => {
      mock.method(macros, "getRollbar", () => ({
        error: () => {},
      }));
    });

    test("basic testing", (t: TestContext) => {
      macros.TEST = false;
      const consoleMock = t.mock.method(console, "warn", () => {});
      t.mock.method(macros, "getRollbar", () => ({
        error: () => {},
      }));
      // It doesn't log unless the LogLevel is WARN or above
      macros.logLevel = LogLevel.CRITICAL;
      macros.warn("test");

      macros.logLevel = LogLevel.ERROR;
      macros.warn("test");
      t.assert.strictEqual(consoleMock.mock.callCount(), 0);

      macros.logLevel = LogLevel.WARN;
      macros.warn("hello4");
      t.assert.deepStrictEqual(consoleMock.mock.calls[0].arguments, [
        "Warning:",
        "hello4".yellow.underline,
      ]);

      macros.logLevel = LogLevel.INFO;
      macros.warn("hello");
      t.assert.deepStrictEqual(consoleMock.mock.calls[1].arguments, [
        "Warning:",
        "hello".yellow.underline,
      ]);

      macros.logLevel = LogLevel.HTTP;
      macros.warn("hello2");
      t.assert.deepStrictEqual(consoleMock.mock.calls[2].arguments, [
        "Warning:",
        "hello2".yellow.underline,
      ]);

      macros.logLevel = LogLevel.VERBOSE;
      macros.warn("test");
      t.assert.deepStrictEqual(consoleMock.mock.calls[3].arguments, [
        "Warning:",
        "test".yellow.underline,
      ]);
    });

    test("warn doesn't log in a test env", (t: TestContext) => {
      t.mock.method(macros, "getRollbar", () => ({
        error: () => {},
      }));
      macros.TEST = true;
      macros.logLevel = LogLevel.WARN;
      const consoleMock = t.mock.method(console, "warn");
      macros.warn("hello4");
      t.assert.strictEqual(consoleMock.mock.callCount(), 0);
    });

    test("warn sends a rollbar error in Prod", (t: TestContext) => {
      t.mock.method(macros, "getRollbar", () => ({
        error: () => {},
      }));
      macros.PROD = true;
      const logRollbarMock = t.mock.method(macros, "logRollbarError", () => {});
      macros.warn("x");
      t.assert.deepStrictEqual(logRollbarMock.mock.calls[0].arguments, [
        ["x"],
        false,
      ]);
    });
  });

  suite("error", () => {
    const env = process.env;

    beforeEach(() => {
      process.env = { ...env };
      mock.method(macros, "getRollbar", () => ({
        error: () => {},
      }));
    });

    test("basic testing", (t: TestContext) => {
      macros.TEST = false;
      const consoleMock = t.mock.method(console, "error");
      macros.logLevel = LogLevel.CRITICAL;
      process.env.CI = undefined;
      macros.error("test");
      t.assert.deepStrictEqual(consoleMock.mock.calls[0].arguments, [
        "Check the /logs directory for more detail: ",
        "'test'",
      ]);

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
      t.assert.strictEqual(consoleMock.mock.callCount(), 6);
    });

    test("doesn't log in test", (t: TestContext) => {
      process.env.CI = undefined;
      macros.TEST = true;
      const consoleMock = t.mock.method(console, "error");
      macros.error("test");
      t.assert.strictEqual(consoleMock.mock.callCount(), 0);
    });

    test("logging in PROD, not CI", (t: TestContext) => {
      macros.PROD = true;
      process.env.CI = undefined;

      const logRollbarMock = t.mock.method(macros, "logRollbarError", () => {});
      macros.warn("x");
      t.assert.deepStrictEqual(logRollbarMock.mock.calls[0].arguments, [
        ["x"],
        false,
      ]);
    });

    test("logging in PROD and CI", (t: TestContext) => {
      macros.PROD = true;
      process.env.CI = "true";
      const processMock = t.mock.method(process, "exit", () => {});

      macros.error("x");
      t.assert.strictEqual(processMock.mock.callCount(), 1);
    });
  });

  suite("critical", () => {
    const env = process.env;

    beforeEach(() => {
      mock.method(macros, "getRollbar", () => ({
        error: () => {},
      }));
      process.env = { ...env };
    });

    afterEach(() => {
      process.env = env;
    });

    test("not in test", (t: TestContext) => {
      macros.TEST = false;
      process.env.CI = undefined;
      const consoleMock = t.mock.method(console, "error");
      const processMock = t.mock.method(process, "exit", () => {});

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

      t.assert.strictEqual(consoleMock.mock.callCount(), 6);
      t.assert.strictEqual(processMock.mock.callCount(), 6);
    });

    test("not in test", (t: TestContext) => {
      macros.TEST = true;
      process.env.CI = undefined;
      const consoleMock = t.mock.method(console, "error");
      const processMock = t.mock.method(process, "exit", () => {});

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
      t.assert.strictEqual(consoleMock.mock.callCount(), 6);
      t.assert.strictEqual(processMock.mock.callCount(), 0);
    });
  });
});
