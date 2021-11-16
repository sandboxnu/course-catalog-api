/* eslint-disable no-underscore-dangle */
/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import { Client } from "@elastic/elasticsearch";
import _ from "lodash";
import pMap from "p-map";
import macros from "./macros";
import {
  EsBulkData,
  EsQuery,
  EsMapping,
  EsMultiResult,
  EsResult,
} from "../types/search_types";
import employeeMap from "../scrapers/employees/employeeMapping.json";
import classMap from "../scrapers/classes/classMapping.json";

const URL: string =
  macros.getEnvVariable("elasticURL") || "http://localhost:9200";
const client = new Client({ node: URL });

const BULKSIZE = 5000;

type ElasticIndex = {
  name: string;
  mapping: any;
  alias: string;
};

export class Elastic {
  public CLASS_ALIAS: string;
  public EMPLOYEE_ALIAS: string;

  private classIndex: ElasticIndex;
  private employeeIndex: ElasticIndex;
  private indexes: ElasticIndex[];
  private initializing: Promise<void>;

  constructor() {
    // Because we export an instance of this class, put the constants on the instance.
    this.CLASS_ALIAS = "classes";
    this.EMPLOYEE_ALIAS = "employees";

    this.classIndex = {
      name: "",
      mapping: classMap,
      alias: this.CLASS_ALIAS,
    };
    this.employeeIndex = {
      name: "",
      mapping: employeeMap,
      alias: this.EMPLOYEE_ALIAS,
    };
    this.indexes = [this.classIndex, this.employeeIndex];
  }

  // This method fetches the exact index name since they are now dynamically named green or blue
  async fetchIndexNames() {
    const isClassesBlue = await this.doesIndexExist("classes_blue");
    const employeesBlue = await this.doesIndexExist("employees_blue");

    const classesName = isClassesBlue ? "classes_blue" : "classes_green";
    const employeesName = employeesBlue ? "employees_blue" : "employees_green";

    this.classIndex.name = classesName;
    this.employeeIndex.name = employeesName;
  }

  async isConnected(): Promise<boolean> {
    try {
      await client.ping();
    } catch (err) {
      return false;
    }
    return true;
  }

  // replace an index with a fresh one with a specified mapping
  async resetIndex(): Promise<any> {
    await this.fetchIndexNames();

    for (const index of this.indexes) {
      const { name, mapping, alias } = index;

      const exists = await this.doesIndexExist(name);
      if (exists) {
        // Clear out the index.
        macros.log(`Deleting index ${name}`);
        await client.indices.delete({ index: name });
        macros.log(`Deleted mapping for index ${name}`);
      }
      // Put in the new classes mapping (elasticsearch doesn't let you change mapping of existing index)
      macros.log(`Creating index ${name}`);
      await client.indices.create({
        index: name,
        body: mapping,
      });
      macros.log(`Created index ${name}`);

      // Once we create a new index, we need to alias it
      macros.log(`Aliasing index ${name} as ${alias}`);
      await client.indices.putAlias({
        index: name,
        name: alias,
      });
      macros.log(`Aliased index ${name} as ${alias}`);
    }
  }

  // This function resets the index without loss of data in the index
  async resetIndexWithoutLoss() {
    await this.fetchIndexNames();

    for (const index of this.indexes) {
      const { name, mapping, alias } = index;
      const exists = await this.doesIndexExist(name);

      // If the index doesn't exist, we can't reindex without loss of data
      if (!exists) {
        macros.error(
          "attempt to reset index without loss when index does not exist"
        );
        break;
      }

      // Create a new index (green or blue depending on current index color)
      let nextIndexName = "";
      const [indexName, color] = name.split("_");
      if (color === "blue") {
        nextIndexName = indexName + "_green";
      } else {
        nextIndexName = indexName + "_blue";
      }

      macros.log(`Creating index ${nextIndexName}`);
      await client.indices.create({
        index: nextIndexName,
        body: mapping,
      });
      macros.log(`Creating index ${nextIndexName}`);

      // Reindex data from the old (current) into the newly made index
      // If the mappings between the two indexes are drastically different,
      // you can pass an optional script parameter to map data cross the mappings.
      // Ideally, this would be configurable outside of the code, for now being left out.
      macros.log(`Reindexing data from index ${name} to ${nextIndexName}`);
      await client.reindex({
        body: {
          source: {
            index: name,
          },
          dest: {
            index: nextIndexName,
          },
        },
      });
      macros.log(`Reindexed data from index ${name} to ${nextIndexName}`);

      // Change the alias to point to our new index
      macros.log(`Aliasing index ${nextIndexName} as ${alias}`);
      await client.indices.putAlias({
        index: nextIndexName,
        name: alias,
      });
      macros.log(`Aliased index ${nextIndexName} as ${alias}`);

      // Delete the old index
      macros.log(`Deleting index ${name}`);
      await client.indices.delete({ index: name });
      macros.log(`Deleted mapping for index ${name}`);

      // Update index name on the class instance
      index.name = nextIndexName;
    }
  }

  private async doesIndexExist(indexName: string): Promise<boolean> {
    const exists =
      (await client.indices.exists({ index: indexName })).statusCode === 200;
    return exists;
  }

  private getIndexNameFromAlias(indexAlias: string): string {
    for (const index of this.indexes) {
      if (index.alias === indexAlias) {
        return index.name;
      }
    }

    return null;
  }

  // Bulk index a collection of documents using ids from hashmap
  // Note that this creates the index if it doesn't exist too
  // https://www.elastic.co/guide/en/elasticsearch/reference/7.16/docs-bulk.html
  async bulkIndexFromMap(indexAlias: string, map: EsBulkData): Promise<any> {
    await this.fetchIndexNames();

    const indexName = this.getIndexNameFromAlias(indexAlias);
    const indexExisted = await this.doesIndexExist(indexName);
    const chunks = _.chunk(Object.keys(map), BULKSIZE);
    await pMap(
      chunks,
      async (chunk, chunkNum) => {
        const bulk = [];
        for (const id of chunk) {
          bulk.push({ index: { _id: id } });
          bulk.push(map[id]);
        }
        // assumes that we are writing to the ES index name, not the ES alias (which doesn't have write privileges)
        const res = await client.bulk({ index: indexName, body: bulk });
        macros.log(
          `indexed ${chunkNum * BULKSIZE + chunk.length} docs into ${indexName}`
        );
        return res;
      },
      { concurrency: 1 }
    );

    // If the index didn't exist, then we need to realias it.
    // If it did exist, it is already associated with an alias
    if (!indexExisted) {
      macros.log(`Aliasing index ${indexName} as ${indexAlias}`);
      await client.indices.putAlias({
        index: indexName,
        name: indexAlias,
      });
      macros.log(`Aliased index ${indexName} as ${indexAlias}`);
    }
  }

  // Send a query to elasticsearch
  async query(
    index: string,
    from: number,
    size: number,
    body: EsQuery
  ): Promise<EsResult> {
    return client.search({
      index: index,
      from: from,
      size: size,
      body: body,
    });
  }

  // Send a MultiQuery to elasticsearch
  async mquery(index: string, queries: EsQuery[]): Promise<EsMultiResult> {
    const multiQuery = [];
    for (const query of queries) {
      multiQuery.push({ index });
      multiQuery.push(query);
    }
    return client.msearch({ body: multiQuery });
  }

  closeClient() {
    client.close();
  }
}

const instance = new Elastic();
export default instance;
