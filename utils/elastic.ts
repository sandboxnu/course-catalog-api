/* eslint-disable no-underscore-dangle */
/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import { Client } from "@elastic/elasticsearch";
import pMap from "p-map";
import _ from "lodash";
import macros from "./macros";
import {
  EsBulkData,
  EsQuery,
  EsMapping,
  EsMultiResult,
  EsResult,
} from "../types/searchTypes";
import employeeMap from "../scrapers/employees/employeeMapping.json";
import classMap from "../scrapers/classes/classMapping.json";
import { ResponseError } from "@elastic/elasticsearch/lib/errors";

const URL: string =
  macros.getEnvVariable("elasticURL") || "http://localhost:9200";
const client = new Client({ node: URL });

const BULKSIZE = 5000;

type ElasticIndex = {
  name: string;
  mapping: any;
};

export class Elastic {
  public CLASS_ALIAS: string;
  public EMPLOYEE_ALIAS: string;

  private indexes: Record<string, ElasticIndex>;

  constructor() {
    // Because we export an instance of this class, put the constants on the instance.
    this.CLASS_ALIAS = "classes";
    this.EMPLOYEE_ALIAS = "employees";

    const classIndex = {
      name: "",
      mapping: classMap,
    };
    const employeeIndex = {
      name: "",
      mapping: employeeMap,
    };
    this.indexes = {};
    this.indexes[this.CLASS_ALIAS] = classIndex;
    this.indexes[this.EMPLOYEE_ALIAS] = employeeIndex;
  }

  async fetchIndexNames(): Promise<void> {
    const aliases = Object.keys(this.indexes);
    await Promise.all(
      aliases.map(async (alias) => await this.fetchIndexName(alias))
    );
  }

  // This method fetches the exact index name since they are now dynamically named green or blue
  async fetchIndexName(aliasName: string): Promise<void> {
    const { mapping } = this.indexes[aliasName];
    const indexNames = [`${aliasName}_blue`, `${aliasName}_green`];

    for (const indexName of indexNames) {
      if (await this.doesIndexExist(indexName)) {
        this.indexes[aliasName].name = indexName;
        return;
      }
    }

    // if neither index exists, create a new index
    const indexName = indexNames[0];
    await this.createIndex(indexName, mapping);
    await this.createAlias(indexName, aliasName);
    this.indexes[aliasName].name = indexName;
  }

  async isConnected(): Promise<boolean> {
    try {
      await client.ping();
    } catch (err) {
      return false;
    }
    return true;
  }

  async createIndex(indexName: string, mapping): Promise<void> {
    macros.log(`Creating index ${indexName}`);
    try {
      await client.indices.create({ index: indexName, body: mapping });
      macros.log(`Created index ${indexName}`);
    } catch (e) {
      macros.error(`Error creating index ${indexName}: ${e}`);
      throw e;
    }
  }

  async deleteIndex(indexName: string): Promise<void> {
    macros.log(`Deleting index ${indexName}`);
    try {
      await client.indices.delete({ index: indexName });
      macros.log(`Deleted index ${indexName}`);
    } catch (e) {
      macros.error(`Error deleting index ${indexName}: ${e}`);
      throw e;
    }
  }

  async createAlias(indexName: string, aliasName: string): Promise<void> {
    macros.log(`Aliasing index ${indexName} as ${aliasName}`);
    try {
      await client.indices.putAlias({ index: indexName, name: aliasName });
      macros.log(`Aliased index ${indexName} as ${aliasName}`);
    } catch (e) {
      macros.error(`Error aliasing ${indexName} as ${aliasName}: ${e}`);
      throw e;
    }
  }

  // replace an index with a fresh one with a specified mapping
  async resetIndex(): Promise<void> {
    await this.fetchIndexNames();

    const aliases = Object.keys(this.indexes);
    for (const alias of aliases) {
      const { name, mapping } = this.indexes[alias];

      const exists = await this.doesIndexExist(name);
      if (exists) {
        // Clear out the index.
        await this.deleteIndex(name);
      }
      // Put in the new mapping (elasticsearch doesn't let you change mapping of existing index)
      await this.createIndex(name, mapping);

      // Once we create a new index, we need to alias it
      await this.createAlias(name, alias);
    }
  }

  // This function resets the index without loss of data in the index
  async resetIndexWithoutLoss(): Promise<void> {
    await this.fetchIndexNames();

    const aliases = Object.keys(this.indexes);
    for (const alias of aliases) {
      const { name, mapping } = this.indexes[alias];

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

      this.createIndex(nextIndexName, mapping);

      // Reindex data from the old (current) into the newly made index
      // If the mappings between the two indexes are drastically different,
      // you can pass an optional script parameter to map data cross the mappings.
      // Ideally, this would be configurable outside of the code, for now being left out.
      macros.log(`Reindexing data from index ${name} to ${nextIndexName}`);
      const reindexResponse = await client.reindex({
        body: {
          source: {
            index: name,
          },
          dest: {
            index: nextIndexName,
          },
        },
        wait_for_completion: false,
      });

      // Here we poll the elasticsearch task, seeing if the task for reindexing is completed.
      // We need to do this because reindexing large indices can cause the original reindex
      // response to time out when waiting on the data to transfer. So instead of waiting, we
      // take the task id and periodically check whether the reindexing task is done before proceeding.
      while (
        !(await client.tasks.get({ task_id: reindexResponse.body["task"] }))
          .body["completed"]
      ) {
        // if the task is incomplete, meaning we enter the while, we sleep the program for 5 seconds
        macros.log(`Checking reindexing status of ${nextIndexName}`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      macros.log(`Reindexed data from index ${name} to ${nextIndexName}`);

      // Change the alias to point to our new index
      await this.createAlias(nextIndexName, alias);

      // Delete the old index
      await this.deleteIndex(name);

      // Update index name on the class instance
      this.indexes[alias].name = nextIndexName;
    }
  }

  private async doesIndexExist(indexName: string): Promise<boolean> {
    const exists =
      (await client.indices.exists({ index: indexName })).statusCode === 200;
    return exists;
  }

  private getIndexNameFromAlias(indexAlias: string): string {
    const aliases = Object.keys(this.indexes);
    for (const alias of aliases) {
      if (alias === indexAlias) {
        return this.indexes[alias].name;
      }
    }

    return null;
  }

  // Bulk index a collection of documents using ids from hashmap
  // Note that this creates the index if it doesn't exist too
  // https://www.elastic.co/guide/en/elasticsearch/reference/7.16/docs-bulk.html
  async bulkIndexFromMap(indexAlias: string, map: EsBulkData): Promise<any> {
    await this.fetchIndexName(indexAlias);

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
        let res = null;

        // We occasionally get 429 errors from Elasticsearch, meaning that we're sending too many requests in too short a time
        // To mitigate that, we make 5 attempts to send the request to Elasticsearch
        for (let i = 0; i++; i < 5) {
          try {
            res = await client.bulk({ index: indexName, body: bulk });
          } catch (e) {
            macros.log(`Caught while bulk upserting: ${e.name} - ${e.message}`);
            // If it's a 429, we'll get a ResponseError
            if (e instanceof ResponseError) {
              macros.warn("Request failed - retrying...");
              // Each time, we want to wait a little longer
              // 750 is an arbitrary multiplier - adjust as needed
              const timeoutMs = (i + 1) * 750;
              // This is a simple blocking function - think `sleep()`, except JS doesn't have one, so this
              //  does the same thing.
              await new Promise((resolve) => setTimeout(resolve, timeoutMs));
            } else {
              throw e;
            }
          }
        }

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
      await this.createAlias(indexName, indexAlias);
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

  closeClient(): void {
    client.close();
  }
}

const instance = new Elastic();
export default instance;
