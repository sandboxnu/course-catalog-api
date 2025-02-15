import { suite, test } from "node:test";

import elastic from "../../utils/elastic";
import classMap from "../../scrapers/classes/classMapping.json";

suite("elastic tests", () => {
  test("fetchIndexNames", async (t) => {
    const mockFetchIndexName = t.mock.method(elastic, "fetchIndexName");

    await elastic.fetchIndexNames();

    for (const name of Object.keys(elastic["indexes"])) {
      t.assert.equal(
        mockFetchIndexName.mock.calls.some(
          (call) => call.arguments[0] === name,
        ),
        true,
      );
    }
  });

  suite("fetchIndexName", () => {
    test("no indexes exist", async (t) => {
      // @ts-ignore - TS does not like us mocking private methods (because they are private!)
      t.mock.method(elastic, "doesIndexExist", () => false);
      t.mock.method(elastic, "createAlias", () => {});
      const mockCreateIndex = t.mock.method(elastic, "createIndex", () => {});

      await elastic.fetchIndexName(elastic.CLASS_ALIAS);

      t.assert.deepEqual(mockCreateIndex.mock.calls[0].arguments, [
        `${elastic.CLASS_ALIAS}_blue`,
        classMap,
      ]);
    });
  });
});
