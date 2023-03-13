/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import Request from "../request.js";

const request = new Request();

it("get should work", async () => {
  const response = await request.get("https://google.com");

  expect(response.body).toBe("response for GET https://google.com");
});

it("post should work", async () => {
  const response = await request.post("https://google.com", {});

  expect(response.body).toBe("response for POST https://google.com");
});
