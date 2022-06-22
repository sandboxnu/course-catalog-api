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
  const indexName = "indexname";
  const aliasName = "aliasname";

  await client.createIndex(indexName, employeeMap);
  await client.createAlias(indexName, aliasName);

  console.log(
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
    ).body.hits
  );

  await client.bulkIndexFromMap(aliasName, {
    "Jason Jason": {
      type: "employee",
      employee: {
        id: "Jason Jason",
        name: "Jason Jason",
        emails: ["jason@jason.jason"],
        phone: "911",
      },
    },
  });

  await bulkUpsertProfs([
    {
      bigPictureUrl: null,
      email: "email",
      emails: ["emails"],
      firstName: null,
      googleScholarId: null,
      id: "id",
      lastName: null,
      link: null,
      name: null,
      officeRoom: null,
      personalSite: null,
      phone: null,
      pic: null,
      primaryDepartment: null,
      primaryRole: null,
      streetAddress: null,
      url: null,
    },
  ]);

  await new Promise((r) => setTimeout(r, 1_000));
  console.log(
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
    ).body.hits
  );

  const body = { query: { match_all: {} } };
  // @ts-expect-error - don't fill the body type out
  console.log((await client.query("_all", 0, 10, body)).body.hits);

  await new Promise((r) => setTimeout(r, 1_000));
  // @ts-expect-error - don't fill the body type out
  console.log((await client.query("_all", 0, 10, body)).body.hits);
});
