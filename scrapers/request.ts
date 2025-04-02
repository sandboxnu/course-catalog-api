/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

import { Agents, OptionsOfTextResponseBody, Response } from "got";
import URI from "urijs";
import objectHash from "object-hash";
import cache from "./cache";
import macros from "../utils/macros";
import { CustomOptions, RequestPool } from "../types/requestTypes";
import { Agent as HttpsAgent } from "https";
import CacheableLookup from "cacheable-lookup";
import logger from "../utils/logger";

// What is this file?
//    This is a wrapper around `got`, the request library we use.
//    This sets default settings so that our scraping is a lot faster.
//
// What changes are made from the defaults?
//    Automatic retries (with delays between requests)
//    Limit the max number of simultaneous requests based on what's been determined to be optimal (via trial and error)
//    DNS caching - this prevents us from doing a DNS lookup for every request, saving time.

// This object contains the DEFAULT settings for each hostname.
const separateReqDefaultPool: RequestPool = {
  options: {
    maxSockets: 50,
    keepAlive: true,
    maxFreeSockets: 50,
  },
  agents: false,
};

// This object contains the DEFAULT settings for SPECIFIC sites.
// These limits were discovered by trial & error.
const separateReqPools: Record<string, RequestPool> = {
  "www.ccis.northeastern.edu": {
    options: {
      maxSockets: 8,
      keepAlive: true,
      maxFreeSockets: 8,
    },
    agents: false,
  },
  "www.khoury.northeastern.edu": {
    options: { maxSockets: 8, keepAlive: true, maxFreeSockets: 8 },
    agents: false,
  },

  // Needed for https://www.northeastern.edu/cssh/faculty
  // Looks like northeastern.edu is just a request redirector and sends any requests for /cssh to another server
  // This is the server that was crashing when tons of requests were sent to /cssh
  // So only requests to /cssh would 500, and not all of northeastern.edu.
  "www.northeastern.edu": {
    options: {
      maxSockets: 25,
      keepAlive: true,
      maxFreeSockets: 25,
    },
    agents: false,
  },

  // Took 1hr and 15 min with 500 sockets and RETRY_DELAY set to 20000 and delta set to 15000.
  // Usually takes just under 1 hr at 1k sockets and the same timeouts.
  // Took around 20 min with timeouts set to 100ms and 150ms and 100 sockets.
  "https://bnrordsp.neu.edu": {
    options: { maxSockets: 100, keepAlive: true, maxFreeSockets: 100 },
    agents: false,
  },
};

// Enable the DNS cache. This module replaces the .lookup method on the built in dns module to cache lookups.
const DNS_CACHE = new CacheableLookup();

const MAX_RETRY_COUNT = 35;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/110.0";
// These numbers are in ms.
const RETRY_DELAY = 100;
const RETRY_DELAY_DELTA = 150;

const CACHE_SAFE_CONFIG_OPTIONS = [
  "method",
  "headers",
  "url",
  "cacheName",
  "cookieJar",
  "cacheRequests",
];

class Request {
  /**
   * The number of currently open requests
   */
  openRequests: number;
  /**
   * A map of hostnames to whether that hostname is active or not.
   * A hostname is active if it had a request since the last analytics interval ran.
   */
  activeHostnames: Record<string, boolean>;

  constructor() {
    this.openRequests = 0;
    this.activeHostnames = {};
  }

  /**
   * Ensures that the given hostname has an associated HTTP and HTTPS agent.
   * Agents are responsible for managing connection persistence and reuse for HTTP clients, which
   * helps make our requests more efficient.
   *
   * Got will automatically resolve the protocol and use the corresponding agent.
   */
  private prepareAgentsForHostname(hostname: string): Agents {
    const pool = separateReqPools[hostname] ?? separateReqDefaultPool;

    if (pool.agents === false) {
      pool.agents = {
        https: new HttpsAgent(pool.options),
      };
    }

    return pool.agents;
  }

  /**
   * Given a config, populates it with default values if those values
   * are not already set.
   */
  private prepareRequestConfig(
    config: CustomOptions,
  ): OptionsOfTextResponseBody {
    const hostname = new URI(config.url).hostname();

    const defaultConfig: Partial<OptionsOfTextResponseBody> = {
      headers: {
        // Manually set the host - due to DNS caching, this might be overridden by the IP,
        // so we want to manually set it (TODO - is this still true)
        Host: hostname,
        "User-Agent": DEFAULT_USER_AGENT,
        // Needed on some old sites that will redirect/block requests when this is not set
        // when a user is requesting a page that is not the entry page of the site
        Referer: config.url,
      },
      // TODO - still necessary? (Old comment ->) Increased from 5 min to help with socket hang up errors.
      timeout: { request: 15 * 60 * 1000 },
      retry: {
        limit: MAX_RETRY_COUNT,
        calculateDelay: () => {
          return RETRY_DELAY + Math.round(Math.random() * RETRY_DELAY_DELTA);
        },
      },
      // Allow fallback to old depreciated insecure SSL ciphers. This is needed when doing application layer dns
      // caching because the url no longer matches the url in the cert.
      https: { rejectUnauthorized: false },
      agent: this.prepareAgentsForHostname(hostname),
      dnsCache: DNS_CACHE,
    };

    // Merge the default config and the input config
    // Need to merge headers and output separately because config.headers object would totally override
    // defaultConfig.headers if merged as one object (Object.assign does shallow merge and not deep merge)
    return {
      ...defaultConfig,
      ...config,
      headers: { ...defaultConfig.headers, ...config.headers },
    };
  }

  /**
   * Sets some configuration options, and sends a request for the given config.
   */
  private async fireRequest(config: CustomOptions): Promise<Response<string>> {
    const hostname = new URI(config.url).hostname();
    this.activeHostnames[hostname] = true;

    const output = this.prepareRequestConfig(config);

    this.openRequests++;

    try {
      // TODO: When (eventually) Jest is remove this can just become a top level
      // import
      const { default: got } = await import("got");
      return await got(output);
    } finally {
      this.openRequests--;
    }
  }

  /**
   * Checks if the given config can use the URL as a cache key.
   * If the only header is `Cookie`, the method is "get", and the only other
   * item in the config is `url`, the URL can safely be used as a cache key
   * (because the data is consistent. With a `POST` request [for example], the returned data
   * varies based on the `POST` data, so we can't map only using the URL - it also needs to
   * take the `POST` data into account)
   */
  private safeToCacheByUrl(config: CustomOptions): boolean {
    if (config.method !== "GET") {
      return false;
    }

    const listOfHeaders = Object.keys(config.headers).filter(
      (key) => key !== "Cookie",
    );

    if (listOfHeaders.length > 0) {
      logger.debug("not caching url by custom headers", {
        headers: listOfHeaders,
        config: { ...config },
      });
      return false;
    }

    const listOfConfigOptions = Object.keys(config).filter(
      (key) => !CACHE_SAFE_CONFIG_OPTIONS.includes(key),
    );

    if (listOfConfigOptions.length > 0) {
      logger.debug("not caching url by custom config options", {
        config: { ...config },
      });
      return false;
    }

    return true;
  }

  /**
   * Creates a hash for a given request config.
   * Ideally, we'd want to skip this, since this call can be *relatively* expensive.
   */
  private hashConfig(config: CustomOptions): string {
    // We want to omit things that change frequently, but shouldn't affect caching
    const cleanHeaders = { ...config.headers, Cookie: undefined };

    const cleanConfig = {
      ...config,
      headers: cleanHeaders,
      cookieJar: undefined,
    };

    return objectHash(cleanConfig);
  }

  /**
   * Returns the cache key for this corresponding config.
   * Allows us to cache responses from requests sent with this config
   */
  private getCacheKey(config: CustomOptions): string {
    // Skipping the hashing when it is not necessary significantly speeds this up.
    if (this.safeToCacheByUrl(config)) {
      return config.url;
    } else {
      return this.hashConfig(config);
    }
  }

  /**
   * Sends a request
   */
  async request(config: CustomOptions): Promise<Response<string>> {
    let newKey: string | undefined;

    // if (macros.DEV && config.cacheRequests) {
    //   newKey = this.getCacheKey(config);
    //
    //   const content = await cache.get(
    //     macros.REQUESTS_CACHE_DIR,
    //     config.cacheName,
    //     newKey,
    //   );
    //
    //   if (content) {
    //     return content as Response<string>;
    //   }
    // }

    try {
      const response = await this.fireRequest(config);

      // // Save the response to a file for development
      // if (macros.DEV && config.cacheRequests) {
      //   await cache.set(
      //     macros.REQUESTS_CACHE_DIR,
      //     config.cacheName,
      //     newKey,
      //     {
      //       body: response.body,
      //       statusCode: response.statusCode,
      //     },
      //     true,
      //   );
      // }

      return response;
    } catch (err) {
      logger.error("error sending request", {
        err: JSON.stringify(err),
        url: config.url,
        openRequests: this.openRequests,
        config: { ...config },
      });

      throw err;
    }
  }
}

const instance = new Request();

class RequestInput {
  cacheName: string;
  config: Partial<CustomOptions>;

  constructor(cacheName: string, config = {}) {
    this.cacheName = cacheName;
    this.config = config;

    // If not specified in the config, default to using the cache
    this.config.cacheRequests ??= true;
  }

  /**
   * Sends a request to the given URL, with the given method and configuration.
   */
  private async request(
    url: string,
    config: Partial<CustomOptions>,
    method: "GET" | "POST",
  ): Promise<Response<string>> {
    config.method = method;
    config.url = url;

    const output = {};

    // Use the fields from this.config that were not specified in cache.
    // Uses .assign() to avoid overwriting our this.config object
    Object.assign(output, this.config, this.normalizeRequestConfig(config));

    return instance.request(output as CustomOptions);
  }

  /**
   * Standardizes a request configuration, adding headers and a cache name
   * if necessary
   */
  normalizeRequestConfig(config: Partial<CustomOptions>): CustomOptions {
    config.headers ??= {};

    // if (macros.DEV) {
    //   if (this.cacheName) {
    //     config.cacheName = this.cacheName;
    //   } else {
    //     // Parse the url hostname from the url.
    //     config.cacheName = new URI(config.url).hostname();
    //   }
    // }

    return config as CustomOptions;
  }

  /**
   * Sends a GET request to the given URL, with the given configuration
   */
  async get(
    url: string,
    config?: Partial<CustomOptions>,
  ): Promise<Response<string>> {
    return this.request(url, config ?? {}, "GET");
  }

  /**
   * Sends a POST request to the given URL, with the given configuration
   */
  async post(
    url: string,
    config: Partial<CustomOptions>,
  ): Promise<Response<string>> {
    if (!config) {
      throw new Error("config not provided");
    }

    // Create a headers object if none exists
    config.headers = config.headers ?? {};

    return this.request(url, config, "POST");
  }
}

export default RequestInput;
