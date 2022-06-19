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
  await expect(
    client.createIndex("indexname", classMap)
  ).rejects.toThrowError();

  await client.deleteIndex("indexname");
  await expect(client.deleteIndex("indexname")).rejects.toThrowError();

  await client.createIndex("indexname", classMap);
  await client.deleteIndex("indexname");
});