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
  const indexName = "indexname";
  const aliasName = "aliasname";

  await client.createIndex(indexName, classMap);
  await expect(client.createIndex(indexName, classMap)).rejects.toThrowError();

  await client.createAlias(indexName, aliasName);

  expect(client["indexes"][aliasName]).toBeUndefined();
  await client.fetchIndexName(aliasName);
  expect(client["indexes"][aliasName]["name"]).toBe(indexName);

  await client.deleteIndex(indexName);
  await expect(client.deleteIndex(indexName)).rejects.toThrowError();

  await client.createIndex(indexName, classMap);
  await client.deleteIndex(indexName);
});

it("queries", async () => {
  const indexName = "indexname";
  const aliasName = "aliasname";

  await client.createIndex(indexName, classMap);
  await client.createAlias(indexName, aliasName);

  console.log(
    await client.query(aliasName, 0, 10, {
      from: 0,
      size: 10,
      sort: [
        "_score",
        {
          "class.classId.keyword": { order: "asc", unmapped_type: "keyword" },
        },
      ],
      query: { match_all: {} },
    })
  );

  await client.bulkIndexFromMap(aliasName, {
    cs3200: {
      type: "class",
      class: {
        host: "test",
      },
      sections: [
        {
          host: "test2",
        },
      ],
    },
  });

  console.log(
    await client.query(aliasName, 0, 10, {
      from: 0,
      size: 10,
      sort: [
        "_score",
        {
          "class.classId.keyword": { order: "asc", unmapped_type: "keyword" },
        },
      ],
      query: { match_all: {} },
    })
  );
});
