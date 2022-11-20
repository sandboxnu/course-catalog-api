import _ from "lodash";
import TermParser from "../termParser";

describe("termParser", () => {
  // not worth testing parseTerm as it just maps other parsers over the results of requests
  // not worth testing requestsClassesForTerm and requestsSectionsForTerm as they just call concatpagination

  describe("concatPagination", () => {
    const mockReq = jest.fn();
    // Mock implementation just returns slices of the range [0,4]
    mockReq.mockImplementation((offset, pageSize) => {
      // This func can potentially return false - helps w tests
      if (pageSize === 1 && offset === 1) {
        return false;
      }
      return {
        items: _.range(offset, Math.min(5, offset + pageSize)),
        totalCount: 5,
      };
    });
    afterEach(() => {
      mockReq.mockClear();
    });

    it("should throw an Error if data is missing", async () => {
      await expect(
        TermParser.concatPagination(async (_x, _y) => false, 200)
      ).rejects.toThrowError("Missing data");
    });

    it("should call the callback with appropriate args", async () => {
      await TermParser.concatPagination(mockReq, 10);
      expect(mockReq.mock.calls).toEqual([
        [0, 1],
        [0, 10],
      ]);
    });

    it("should default to asking for 500 items", async () => {
      const data = await TermParser.concatPagination(mockReq);
      expect(data).toEqual([0, 1, 2, 3, 4]);
      expect(mockReq.mock.calls).toEqual([
        [0, 1],
        [0, 500],
      ]);
    });

    it("should make multiple requests and stitch together", async () => {
      const data = await TermParser.concatPagination(mockReq, 2);
      expect(data).toEqual([0, 1, 2, 3, 4]);
      expect(mockReq.mock.calls).toEqual([
        [0, 1],
        [0, 2],
        [2, 2],
        [4, 2],
      ]);
    });

    it("should throw an error if some data chunks return false", async () => {
      // Any calls to the mock req of (1, 1) will return false
      // This should trigger an error down the line, since data is missing
      await expect(
        TermParser.concatPagination(mockReq, 1)
      ).rejects.toThrowError("Missing data");
    });
  });
});
