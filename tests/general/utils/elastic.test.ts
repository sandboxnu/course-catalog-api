import elastic from "../../../utils/elastic";
import classMap from "../../../scrapers/classes/classMapping.json";

describe("elastic tests", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
  });

  it("fetchIndexNames", async () => {
    jest.spyOn(elastic, "fetchIndexName");

    await elastic.fetchIndexNames();

    for (const name of Object.keys(elastic["indexes"])) {
      expect(elastic.fetchIndexName).toHaveBeenCalledWith(name);
    }
  });

  describe("fetchIndexName", () => {
    it("no indexes exist", async () => {
      elastic["doesIndexExist"] = jest.fn().mockImplementationOnce(() => false);
      elastic.createAlias = jest.fn().mockImplementationOnce(() => {
        // void
      });
      elastic.createIndex = jest.fn().mockImplementationOnce(() => {
        // void
      });

      await elastic.fetchIndexName(elastic.CLASS_ALIAS);
      expect(elastic.createIndex).toHaveBeenCalledWith(
        `${elastic.CLASS_ALIAS}_blue`,
        classMap
      );
    });
  });
});
