/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import linkSpider from "../linkSpider";

it("should parse 5 links from a page", async () => {
  const output = await linkSpider.main(["https://google.com/fivelinks"]);

  expect(output).toMatchSnapshot();
});

it("no urls", async () => {
  expect(await linkSpider.main(null)).toBeNull();
  expect(await linkSpider.main([])).toBeNull();
});

it("should ignore links that are to a different domain", async () => {
  const output = await linkSpider.main(["https://google.com/somecrossdomain"]);

  expect(output).toEqual([
    "https://google.com/circletest",
    "https://google.com/justanotherurl",
  ]);
});

// Should follow the first url to the next page
// and in the end, end up with the url of the second page, and both of the urls on the second page.
it("should ignore links that are already scraped also depth test", async () => {
  const output = await linkSpider.main(["https://google.com/circletest"], 5);

  expect(output).toEqual([
    "https://google.com/somecrossdomain",
    "https://google.com/circletest",
    "https://google.com/justanotherurl",
  ]);
});
