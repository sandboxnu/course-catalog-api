import classMap from "../../scrapers/classes/classMapping.json";
import client from "../../utils/elastic";

it("Connections", async () => {
  expect(await client.isConnected()).toBeTruthy();
});

it("fetchIndexName", async () => {
  expect(client["indexes"]["classes"]).toBeUndefined();
  await client.fetchIndexName("classes");

  expect(client["indexes"]["classes"]).toBe("classes_blue");
});

it("Creating indexes", async () => {
  await client.createIndex("indexname", classMap);
  await client.createIndex("indexname", classMap);
});
