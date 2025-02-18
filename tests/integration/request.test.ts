/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */
import { test } from "node:test";

// NOTE: This test making requests to the interwebs has cause problems
// (mostly with DNS lookup). This needs to be tested a different way altogether
// but for sake of consitency *now* it is being ported

import Request from "../../scrapers/request";

const request = new Request("request_test", { cacheRequests: false });

test("get should work", { timeout: 10000 }, async (t) => {
  const response = await request.get("https://httpbin.org/get");

  t.assert.equal(JSON.parse(response.body)["url"], "https://httpbin.org/get");
});

test("post should work", { timeout: 10000 }, async (t) => {
  const response = await request.post("https://httpbin.org/post", {
    form: {
      arg1: "data",
    },
  });

  t.assert.deepEqual(JSON.parse(response.body).form, {
    arg1: "data",
  });
});
