import classMap from "../../scrapers/classes/classMapping.json";
import client from "../../utils/elastic";

it("Connections", async () => {
  expect(await client.isConnected()).toBeTruthy();
});

it("fetchIndexName", async () => {
  expect(client["indexes"]["classes"]).toEqual({
    name: "",
    mapping: classMap,
  });
  await client.fetchIndexName("classes");

  expect(client["indexes"]["classes"]["name"]).toBe("classes_blue");
});

it("Creating indexes", async () => {
  await client.createIndex("indexname", classMap);
  expect(
    async () => await client.createIndex("indexname", classMap)
  ).toThrowError();

  await client.deleteIndex("indexname");
  expect(async () => await client.deleteIndex("indexname")).toThrowError();

  await client.createIndex("indexname", classMap);
  await client.deleteIndex("indexname");
});

it("resetting indexes", async () => {
  await client.createIndex("indexname", { mappings: {} });
  await client.createAlias("indexname", "indexname2");

  expect(client["indexes"]["indexname"].mapping).toEqual({
    mappings: {},
  });

  await client.resetIndex();

  expect(client["indexes"]["indexname"].mapping).toEqual(classMap);
});
