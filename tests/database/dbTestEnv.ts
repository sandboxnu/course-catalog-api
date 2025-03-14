/* eslint-disable @typescript-eslint/no-var-requires */
// tests/nexus-test-environment.js
import dotenv from "dotenv";
const { Client } = require("pg");
const NodeEnvironment = require("jest-environment-node").TestEnvironment;
const { v4: uuid } = require("uuid");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const prismaBinary = "./node_modules/.bin/prisma";

/**
 * Custom test environment for Nexus, Prisma and Postgres
 */
class PrismaTestEnvironment extends NodeEnvironment {
  constructor(config) {
    super(config);
    // Generate a unique schema identifier for this test context
    this.schema = `test_${uuid()}`;
    // Generate the pg connection string for the test schema
    dotenv.config();
    this.databaseUrl = `postgresql://postgres:${process.env.POSTGRES_PASSWORD}@localhost:5432/searchneu_test?schema=${this.schema}`;
  }

  async setup() {
    // Set the equired environment variable to contain the connection string
    // to our database test schema
    process.env.DATABASE_URL = this.databaseUrl;
    this.global.process.env.DATABASE_URL = this.databaseUrl;
    process.env.DATABASE_URL_WITH_CONNECTIONS = this.databaseUrl;
    this.global.process.env.DATABASE_URL_WITH_CONNECTIONS = this.databaseUrl;
    // Run the migrations to ensure our schema has the required structure
    await exec(`${prismaBinary} migrate dev --preview-feature`);
    await exec(`${prismaBinary} generate`);
    return super.setup();
  }

  async teardown() {
    // Drop the schema after the tests have completed
    const client = new Client({
      connectionString: this.databaseUrl,
    });
    await client
      .connect()
      .then(() => console.log(`Connected to ${this.databaseUrl}`))
      .catch((err) => console.log(err));
    await client
      .query(`DROP SCHEMA IF EXISTS "${this.schema}" CASCADE`)
      .then(() => console.log(`Dropped schema '${this.schema}' (if exists)`))
      .catch((err) => console.log(err))
      .finally(() => client.end);

    await client.end();
  }
}
module.exports = PrismaTestEnvironment;
