import { snapshot, before, after } from "node:test";
import { basename, dirname, extname, join } from "node:path";
import { exec } from "child_process";
import { Client } from "pg";
import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";

// NOTE: To run the integration tests:
// yarn tsx --import ./tests/integration/setup.ts --experimental-test-snapshots --experimental-test-isolation=none --test "tests/integration/*.test.ts"
// The experimental-test-snapshots flag is not necessary for v23.4.0
// The experimental-test-isolation should be changed to --test-isolation=none in v23.4.0
// Add the --test-update-snapshots flag to regenerate the snapshots

// BUG: Yeah this needs to be not linked to the binary for when / if the binaries move
const prismaBinary = "./node_modules/.bin/prisma";
const aexec = promisify(exec);

snapshot.setResolveSnapshotPath(generateSnapshotPath);
function generateSnapshotPath(testFilePath: string | undefined) {
  const ext = extname(testFilePath ?? "");
  const filename = basename(testFilePath ?? "", ext);
  const base = dirname(testFilePath ?? "");

  return join(base, `snapshots/${filename}.snap.cjs`);
}

// Setup
dotenv.config();
const schema = "test_" + randomUUID();
const testdb_url = `postgresql://postgres:${process.env.POSTGRES_PASSWORD}@localhost:5432/searchneu_test?schema=${schema}`;

before(async () => {
  process.env.DATABASE_URL = testdb_url;
  global.process.env.DATABASE_URL = testdb_url;
  process.env.DATABASE_URL_WITH_CONNECTIONS = testdb_url;
  global.process.env.DATABASE_URL_WITH_CONNECTIONS = testdb_url;

  // Run the migrations to ensure our schema has the required structure
  await aexec(`${prismaBinary} migrate dev`);
  await aexec(`${prismaBinary} generate`);
});

after(async () => {
  // Teardown func
  // Drop the schema after the tests have completed
  const client = new Client({
    connectionString: testdb_url,
  });

  await client
    .connect()
    .then(() => console.log(`Connected to ${testdb_url}`))
    .catch((err: any) => console.log(err));
  await client
    .query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    .then(() => console.log(`Dropped schema '${schema}' (if exists)`))
    .catch((err: any) => console.log(err))
    .finally(() => client.end);

  await client.end();
});
