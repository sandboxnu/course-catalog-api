import classMap from "../../scrapers/classes/classMapping.json";
import client from "../../utils/elastic";
import employeeMap from "../../scrapers/employees/employeeMapping.json";

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
  const aliasName = "e2e_employees_jason";

  client["indexes"][aliasName] = {
    name: `${aliasName}_blue`,
    mapping: employeeMap,
  };

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

  await new Promise((resolve) => setTimeout(resolve, 1_000)); // We need a little pause for the indexing

  const getId = async (): Promise<string> => {
    // @ts-expect-error - body type is inaccurate
    const resp = await client.query(aliasName, 0, 10, {
      query: { match_all: {} },
    });
    return resp?.body?.hits?.hits?.[0]?.["_id"] ?? "";
  };

  expect(await getId()).toBe(id);

  await client.resetIndexWithoutLoss();
  await new Promise((resolve) => setTimeout(resolve, 1_000)); // We need a little pause for the indexing

  expect(await getId()).toBe(id);
}, 40_000);
