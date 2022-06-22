import classMap from "../../scrapers/classes/classMapping.json";
import client from "../../utils/elastic";
import employeeMap from "../../scrapers/employees/employeeMapping.json";
import { bulkUpsertProfs } from "../../scripts/populateES";

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

  // @ts-expect-error - we know the type is missing, that's the point
  client["indexes"][aliasName] = { mapping: classMap };
  expect(client["indexes"][aliasName]["name"]).toBeUndefined();
  await client.fetchIndexName(aliasName);
  expect(client["indexes"][aliasName]["name"]).toMatch(`${aliasName}_`);

  await client.deleteIndex(indexName);
  await expect(client.deleteIndex(indexName)).rejects.toThrowError();

  await client.createIndex(indexName, classMap);
  await client.deleteIndex(indexName);
});

it("queries", async () => {
  const aliasName = "employees_2";

  // @ts-expect-error - we know the type is missing, that's the point
  client["indexes"][aliasName] = { mapping: employeeMap };

  const id = "Jason Jason";
  await client.bulkIndexFromMap(aliasName, {
    "Jason Jason": {
      type: "employee",
      employee: {
        id: id,
        name: "Jason Jason",
        emails: ["jason@jason.jason"],
        phone: "911",
      },
    },
  });

  // We need a little pause for the indexing
  // eslint-disable-next-line  promise/param-names
  await new Promise((r) => setTimeout(r, 1_000));

  expect(
    (
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
    ).body.hits.hits[0]["_id"]
  ).toBe(id);
});
