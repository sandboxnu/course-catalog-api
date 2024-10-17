import cache from "../cache";
import macros from "../../utils/macros";
import path from "path";
import fs from "fs-extra";

const CACHE_DIR = "_TEST";
const FULL_CACHE_DIR = path.join("cache", CACHE_DIR);

describe("Cache", () => {
  let devDir: string;
  beforeAll(() => {
    devDir = macros.DEV_DATA_DIR;
    // @ts-expect-error, read-only property
    macros.DEV_DATA_DIR = CACHE_DIR;
    fs.mkdirSync(FULL_CACHE_DIR, { recursive: true });
  });

  afterAll(() => {
    // @ts-expect-error, read-only property
    macros.DEV_DATA_DIR = devDir;
    fs.rmdirSync(FULL_CACHE_DIR, { recursive: true });
  });

  it("getFilePath", () => {
    expect(cache.getFilePath("foldername", "classname")).toBe(
      "cache/foldername/classname.cache",
    );
    expect(cache.getFilePath("foldername//", "classname")).toBe(
      "cache/foldername/classname.cache",
    );
  });

  describe("verifyFolderName", () => {
    it("valid folder names", () => {
      expect(cache.verifyFolderName(CACHE_DIR)).toBeUndefined();
      expect(cache.verifyFolderName(macros.DEV_DATA_DIR)).toBeUndefined();
      expect(cache.verifyFolderName(macros.REQUESTS_CACHE_DIR)).toBeUndefined();
    });

    it("invalid folder names", () => {
      jest.spyOn(macros, "critical").mockImplementationOnce(() => {
        // don't throw the error
      });

      const invalidName = "not a valid name";
      cache.verifyFolderName(invalidName);
      expect(macros.critical).toHaveBeenCalledWith(
        expect.stringMatching(/folder name must be/i),
        invalidName,
      );
    });
  });

  describe("saving/loading", () => {
    const filePath = cache.getFilePath(CACHE_DIR, "file");
    let dataMap;

    beforeEach(() => {
      dataMap = {
        hello: "world",
      };

      cache.dataPromiseMap[filePath] = dataMap;
    });

    it("loading an existing file", async () => {
      await cache.save(filePath, false);
      expect(await cache.loadFile(filePath)).toBeUndefined();
    });

    it("saved as json", async () => {
      await cache.save(filePath, false);
      delete cache.dataPromiseMap[filePath];
      await cache.ensureLoaded(filePath);

      expect(await cache.dataPromiseMap[filePath]).toEqual(dataMap);
    });

    it("saved as msgpack", async () => {
      await cache.save(filePath, true);
      delete cache.dataPromiseMap[filePath];
      await cache.ensureLoaded(filePath);

      expect(await cache.dataPromiseMap[filePath]).toEqual(dataMap);
    });
  });

  describe("getting and setting", () => {
    const filePath = cache.getFilePath(CACHE_DIR, "file");
    let dataMap;

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

    beforeAll(() => {
      macros.DEV = true;
      macros.TEST = false;
      jest.useFakeTimers();
    });

    afterAll(() => {
      macros.DEV = false;
      macros.TEST = true;
      jest.useRealTimers();
    });

    it("gets a value", async () => {
      expect(await cache.get(CACHE_DIR, "file", "hello")).toBe("world");
      expect(await cache.get(CACHE_DIR, "file", "test")).toBe(dataMap.test);
    });

    it("gets undefined values", async () => {
      expect(await cache.get(CACHE_DIR, "file", "fake key")).toBeUndefined();
    });

    describe("set", () => {
      it("can set and retrieve an object", async () => {
        await cache.set(CACHE_DIR, "file", "test2", "helloworld");
        expect(await cache.get(CACHE_DIR, "file", "test2")).toBe("helloworld");

        await cache.set(CACHE_DIR, "file", "test2", ["array"], true);
        expect(await cache.get(CACHE_DIR, "file", "test2")).toEqual(["array"]);
      });
    });
  });
});
