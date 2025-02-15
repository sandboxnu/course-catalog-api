/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import Request from "../../../scrapers/request";
// Give extra time to ensure that the initial DNS lookup works
jest.setTimeout(10_000);

const request = new Request("request_test", { cacheRequests: false });

it("get should work", async () => {
  const response = await request.get("https://httpbin.org/get");

  expect(JSON.parse(response.body)["url"]).toBe("https://httpbin.org/get");
});

it("post should work", async () => {
  const response = await request.post("https://httpbin.org/post", {
    form: {
      arg1: "data",
    },
  });

  expect(JSON.parse(response.body).form).toEqual({
    arg1: "data",
  });
});
