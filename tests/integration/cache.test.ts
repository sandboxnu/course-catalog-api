import cache from "../../scrapers/cache";
import macros from "../../utils/macros";
import path from "path";
import fs from "fs-extra";
import {
  suite,
  test,
  before,
  after,
  beforeEach,
  type TestContext,
} from "node:test";

const CACHE_DIR = "_TEST";
const FULL_CACHE_DIR = path.join("cache", CACHE_DIR);

suite("Cache", async () => {
  let devDir: string;

  before(() => {
    devDir = macros.DEV_DATA_DIR;
    // @ts-expect-error, read-only property
    macros.DEV_DATA_DIR = CACHE_DIR;
    fs.mkdirSync(FULL_CACHE_DIR, { recursive: true });
  });

  after(() => {
    // @ts-expect-error, read-only property
    macros.DEV_DATA_DIR = devDir;
    fs.rmSync(FULL_CACHE_DIR, { recursive: true });
  });

  test("getFilePath", (t: TestContext) => {
    t.assert.equal(
      cache.getFilePath("foldername", "classname"),
      "cache/foldername/classname.cache",
    );
    t.assert.equal(
      cache.getFilePath("foldername//", "classname"),
      "cache/foldername/classname.cache",
    );
  });

  suite("verifyFolderName", async () => {
    test("valid folder names", (t: TestContext) => {
      t.assert.equal(cache.verifyFolderName(CACHE_DIR), undefined);
      t.assert.equal(cache.verifyFolderName(macros.DEV_DATA_DIR), undefined);
      t.assert.equal(
        cache.verifyFolderName(macros.REQUESTS_CACHE_DIR),
        undefined,
      );
    });

    test("invalid folder names", (t: TestContext) => {
      t.mock.method(macros, "critical", () => {});

      const invalidName = "not a valid name";
      cache.verifyFolderName(invalidName);

      // Use a spy-like approach to test if critical was called
      let wasCalled = false;
      const originalCriticalTemp = macros.critical;
      macros.critical = (message, arg) => {
        if (
          typeof message === "string" &&
          message.match(/folder name must be/i) &&
          arg === invalidName
        ) {
          wasCalled = true;
        }
        return originalCriticalTemp(message, arg);
      };

      cache.verifyFolderName(invalidName);
      t.assert.equal(wasCalled, true);
    });
  });

  suite("saving/loading", async () => {
    const filePath = cache.getFilePath(CACHE_DIR, "file");
    let dataMap: any;

    beforeEach(() => {
      dataMap = {
        hello: "world",
      };
      cache.dataPromiseMap[filePath] = dataMap;
    });

    test("loading an existing file", async (t: TestContext) => {
      await cache.save(filePath, false);
      t.assert.equal(await cache.loadFile(filePath), undefined);
    });

    test("saved as json", async (t: TestContext) => {
      await cache.save(filePath, false);
      delete cache.dataPromiseMap[filePath];
      await cache.ensureLoaded(filePath);
      t.assert.deepEqual(await cache.dataPromiseMap[filePath], dataMap);
    });

    test("saved as msgpack", async (t: TestContext) => {
      await cache.save(filePath, true);
      delete cache.dataPromiseMap[filePath];
      await cache.ensureLoaded(filePath);
      t.assert.deepEqual(await cache.dataPromiseMap[filePath], dataMap);
    });
  });

  suite("getting and setting", async () => {
    const filePath = cache.getFilePath(CACHE_DIR, "file");
    let dataMap: any;
    let originalDev: boolean;
    let originalTest: boolean;

    before(() => {
      originalDev = macros.DEV;
      originalTest = macros.TEST;
      macros.DEV = true;
      macros.TEST = false;

      // Node test runner doesn't have a direct equivalent to jest.useFakeTimers()
      // You might need to use a separate timer mocking library or implement a custom solution
    });

    after(() => {
      macros.DEV = originalDev;
      macros.TEST = originalTest;

      // No direct equivalent to jest.useRealTimers()
    });

    beforeEach(async () => {
      dataMap = {
        hello: "world",
        test: {
          this: "is",
          a: [
            {
              complex: "object",
            },
          ],
        },
      };
      cache.dataPromiseMap[filePath] = dataMap;
      await cache.save(filePath, true);
    });

    test("gets a value", async (t: TestContext) => {
      t.assert.equal(await cache.get(CACHE_DIR, "file", "hello"), "world");
      t.assert.equal(await cache.get(CACHE_DIR, "file", "test"), dataMap.test);
    });

    test("gets undefined values", async (t: TestContext) => {
      t.assert.equal(await cache.get(CACHE_DIR, "file", "fake key"), undefined);
    });

    suite("set", async () => {
      test("can set and retrieve an object", async (t: TestContext) => {
        await cache.set(CACHE_DIR, "file", "test2", "helloworld");
        t.assert.equal(
          await cache.get(CACHE_DIR, "file", "test2"),
          "helloworld",
        );

        await cache.set(CACHE_DIR, "file", "test2", ["array"], true);
        t.assert.deepEqual(await cache.get(CACHE_DIR, "file", "test2"), [
          "array",
        ]);
      });
    });
  });
});
