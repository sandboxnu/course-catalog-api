/*
 * This file is part of Search NEU and licensed under AGPL3.
 * See the license file in the root folder for details.
 */

// ESLint added some new rules that require one class per file.
// That is generally a good idea, perhaps we could change over this file one day.
/* eslint-disable max-classes-per-file */

import got, { OptionsOfTextResponseBody, Response } from "got";
import URI from "urijs";
import retry from "async-retry";
import objectHash from "object-hash";
import moment from "moment";
import dnsCache from "dnscache";
import cache from "./cache";
import macros from "../utils/macros";
import {
  RequestAnalytics,
  CustomOptions,
  RequestPool,
  AmplitudeEvent,
  AgentAnalytics,
} from "../types/requestTypes";
import { EmptyObject } from "../types/types";

// This file is a transparent wrapper around the request library that changes some default settings so scraping is a lot faster.
// This file adds:
// Automatic retry, with a delay in between reqeusts.
// Limit the max number of simultaneous requests (this used to be done with d3-queue, but is now done with agent.maxSockets)
// Application layer DNS cacheing. The request library (and the built in http library) will do a separate DNS lookup for each request
//    This DNS cacheing will do one DNS lookup per hostname (www.ccis.northeastern.edu, wl11gp.neu.edu) and cache the result.
//    This however, does change the URL that is sent to the request library (hostname -> pre-fetched ip), which means that the https verificaton will be comparing
//    the URL in the cert with the IP in the url, which will fail. Need to disable https verification for this to work.
// Keep-alive connections. Keep TCP connections open between requests. This significantly speeds up scraping speeds (1hr -> 20min)
// Ignore invalid HTTPS certificates and outdated ciphers. Some school sites have really old and outdated sites. We want to scrape them even if their https is misconfigured.
// Saves all pages to disk in development so parsers are faster and don't need to hit actuall websites to test updates for scrapers
// ignores request cookies when matching request for caching
// see the request function for details about input (same as request input + some more stuff) and output (same as request 'response' object + more stuff)

// Would it be worth to assume that these sites have a cache and hit all the subjects, and then hit all the classes, etc?
// So assume that when you hit one subject it caches that subject and others nearby.

// TODO:
// Sometimes many different hostnames all point to the same IP. Need to limit requests by an IP basis and a hostname basis (COS).
// Need to improve the cache. Would save everything in one object, but 268435440 (268 MB) is roughly the max limit of the output of JSON.stringify.
// https://github.com/nodejs/node/issues/9489#issuecomment-279889904

// This object must be created once per process
// Attributes are added to this object when it is used
// This is the total number of requests per host
// If these numbers ever exceed 1024, might want to ensure that there are more file descriptors available on the OS for this process
// than we are trying to request. Windows has no limit and travis has it set to 500k by default, but Mac OSX and Linux Desktop often have them
// set really low (256) which could interefere with this.
// https://github.com/request/request
const separateReqDefaultPool: RequestPool = {
  maxSockets: 50,
  keepAlive: true,
  maxFreeSockets: 50,
};

// Specific limits for some sites. CCIS has active measures against one IP making too many requests
// and will reject request if too many are made too quickly.
// Some other schools' servers will crash/slow to a crawl if too many requests are sent too quickly.
const separateReqPools: Record<string, RequestPool> = {
  "www.ccis.northeastern.edu": {
    maxSockets: 8,
    keepAlive: true,
    maxFreeSockets: 8,
  },
  "www.khoury.northeastern.edu": {
    maxSockets: 8,
    keepAlive: true,
    maxFreeSockets: 8,
  },

  // Needed for https://www.northeastern.edu/cssh/faculty
  // Looks like northeastern.edu is just a request redirector and sends any requests for /cssh to another server
  // This is the server that was crashing when tons of requests were sent to /cssh
  // So only requests to /cssh would 500, and not all of northeastern.edu.
  "www.northeastern.edu": {
    maxSockets: 25,
    keepAlive: true,
    maxFreeSockets: 25,
  },

  "genisys.regent.edu": { maxSockets: 50, keepAlive: true, maxFreeSockets: 50 },
  "prod-ssb-01.dccc.edu": {
    maxSockets: 100,
    keepAlive: true,
    maxFreeSockets: 100,
  },
  "telaris.wlu.ca": { maxSockets: 400, keepAlive: true, maxFreeSockets: 400 },
  "myswat.swarthmore.edu": {
    maxSockets: 1000,
    keepAlive: true,
    maxFreeSockets: 1000,
  },
  "bannerweb.upstate.edu": {
    maxSockets: 200,
    keepAlive: true,
    maxFreeSockets: 200,
  },

  // Took 1hr and 15 min with 500 sockets and RETRY_DELAY set to 20000 and delta set to 15000.
  // Usually takes just under 1 hr at 1k sockets and the same timeouts.
  // Took around 20 min with timeouts set to 100ms and 150ms and 100 sockets.
  "wl11gp.neu.edu": { maxSockets: 100, keepAlive: true, maxFreeSockets: 100 },
};

// Enable the DNS cache. This module replaces the .lookup method on the built in dns module to cache lookups.
// The old way of doing DNS caching was to do a dns lookup of the domain before the request was made,
// and then swap out the domain with the ip in the url. (And cache the dns lookup manually.)
// Use this instead of swapping out the domain with the ip in the fireRequest function so the cookies still work.
// (There was some problems with saving them because, according to request, the host was the ip, but the cookies were configured to match the domain)
// It would be possible to go back to manual dns lookups and therefore manual cookie jar management if necessary (wouldn't be that big of a deal).
// https://stackoverflow.com/questions/35026131/node-override-request-ip-resolution
// https://gitter.im/request/request
// https://github.com/yahoo/dnscache
dnsCache({
  enable: true,
  ttl: 999999999,
  cachesize: 999999999,
});

const MAX_RETRY_COUNT = 35;
const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:53.0) Gecko/20100101 Firefox/53.0";
// These numbers are in ms.
const RETRY_DELAY = 100;
const RETRY_DELAY_DELTA = 150;

const CACHE_SAFE_CONFIG_OPTIONS = [
  "method",
  "headers",
  "url",
  "cacheName",
  "jar",
  "cache",
];

const LAUNCH_TIME = moment();

class Request {
  /**
   * The number of currently open requests
   */
  openRequests: number;
  /**
   * A map of hostnames to their corresponding analytics object.
   * Each hostname has its own unique analytics record.
   */
  analytics: RequestAnalytics;
  /**
   * A map of hostnames to whether that hostname is active or not.
   * A hostname is active if it had a request since the last analytics interval ran.
   */
  activeHostnames: Record<string, boolean>;
  /**
   * The analytics timer object.
   */
  timer?: NodeJS.Timeout;

  constructor() {
    this.openRequests = 0;
    this.analytics = {};
    this.activeHostnames = {};
  }

  /**
   * Ensures that an analytics object exists for the given hostname,
   * creating a new object if one doesn't already exist.
   */
  private ensureAnalyticsObject(hostname: string): void {
    if (!(hostname in this.analytics)) {
      this.analytics[hostname] = {
        totalBytesDownloaded: 0,
        totalErrors: 0,
        totalGoodRequests: 0,
        startTime: null,
      };
    }
  }

  /**
   * Gets analytics from a request pool's agent.
   * When sending a request with an associated pool, `request` will search the pool for a custom agent.
   * If no custom agent is found, a new agent will be created and added to the pool.
   */
  private getAnalyticsFromAgent(
    pool: RequestPool
  ): EmptyObject | AgentAnalytics {
    const agent = pool["https:false:ALL"] ?? pool["http:"];

    if (!agent) {
      macros.http("Agent is false,", pool);
      return {};
    }

    const moreAnalytics = {
      socketCount: 0,
      requestCount: 0,
      maxSockets: pool.maxSockets,
    };

    for (const arr of Object.values(agent.sockets)) {
      moreAnalytics.socketCount += arr.length;
    }

    for (const arr of Object.values(agent.requests)) {
      moreAnalytics.requestCount += arr.length;
    }
    return moreAnalytics;
  }

  /**
   * Logs all currently active hostname analytics objects.
   * After this method runs, all hostnames are marked as inactive until they handle another request
   */
  private logHostnameAnalytics(): void {
    const analyticsHostnames = Object.entries(this.analytics);

    for (const [hostname, analytics] of analyticsHostnames) {
      if (!this.activeHostnames[hostname]) {
        continue;
      }
      if (!(hostname in separateReqPools)) {
        macros.http(hostname);
        macros.http(JSON.stringify(analytics, null, 4));
        continue;
      }

      const moreAnalytics = this.getAnalyticsFromAgent(
        separateReqPools[hostname]
      );
      const totalAnalytics: Partial<AmplitudeEvent> = {
        ...moreAnalytics,
        ...analytics,
      };

      macros.http(hostname);
      macros.http(JSON.stringify(totalAnalytics, null, 4));

      totalAnalytics.hostname = hostname;
      macros.logAmplitudeEvent("Scrapers", totalAnalytics as AmplitudeEvent);
    }

    this.activeHostnames = {};
  }

  /**
   * Logs all of the analytics objects that exist in at the moment.
   */
  private logAnalytics(): void {
    this.logHostnameAnalytics();

    // Shared pool
    const sharedPoolAnalytics: Partial<AmplitudeEvent> =
      this.getAnalyticsFromAgent(separateReqDefaultPool);
    macros.http(JSON.stringify(sharedPoolAnalytics, null, 4));
    sharedPoolAnalytics.hostname = "shared";
    macros.logAmplitudeEvent("Scrapers", sharedPoolAnalytics as AmplitudeEvent);

    if (this.openRequests === 0) {
      clearInterval(this.timer);
    }

    const currentTime = moment();
    const uptime = moment.duration(moment().diff(LAUNCH_TIME)).asMinutes();
    macros.http("Uptime:", uptime, `(${currentTime.format("h:mm:ss a")})`);
  }

  /**
   * Given a config, populates it with default values if those values
   * are not already set.
   */
  private prepareRequestConfig(
    config: CustomOptions
  ): OptionsOfTextResponseBody {
    const hostname = new URI(config.url).hostname();

    const defaultConfig: Partial<OptionsOfTextResponseBody> = {
      headers: {},
    };

    // Default to JSON for POST bodies
    if (config.method === "POST") {
      defaultConfig.headers["Content-Type"] = "application/json";
    }

    // TODO enable
    // defaultConfig.pool = separateReqPools[hostname] ?? separateReqDefaultPool;

    // TODO - still necessary? (Old comment ->) Increased from 5 min to help with socket hang up errors.
    defaultConfig.timeout = { request: 15 * 60 * 1000 };

    // Allow fallback to old depreciated insecure SSL ciphers. Some school websites are really old  :/
    // We don't really care abouzt security (hence the rejectUnauthorized: false), and will accept anything.
    // Additionally, this is needed when doing application layer dns
    // caching because the url no longer matches the url in the cert.
    defaultConfig.https.rejectUnauthorized = false;
    defaultConfig.https.ciphers = "ALL";

    // Set the host in the header to the hostname on the url.
    // This is not done automatically because of the application layer
    // dns caching (it would be set to the ip instead)
    defaultConfig.headers.Host = hostname;

    defaultConfig.headers["User-Agent"] = DEFAULT_USER_AGENT;

    // Needed on some old sites that will redirect/block requests when this is not set
    // when a user is requesting a page that is not the entry page of the site
    defaultConfig.headers.Referer = config.url;

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
    this.ensureAnalyticsObject(hostname);
    this.activeHostnames[hostname] = true;

    const output = this.prepareRequestConfig(config);

    macros.http("Firing request to", output.url);

    // If there are not any open requests right now, start the analytics interval
    if (this.openRequests === 0 && (!macros.PROD || process.env.CI)) {
      clearInterval(this.timer);
      macros.http("Starting request analytics timer.");
      this.analytics[hostname].startTime = Date.now();
      this.timer = setInterval(() => this.logAnalytics(), 5000);
      this.logAnalytics();
    }

    this.openRequests++;

    try {
      return await got(output.url, output);
    } finally {
      this.openRequests--;

      if (this.openRequests === 0 && (!macros.PROD || process.env.CI)) {
        macros.http("Stopping request analytics timer.");
        clearInterval(this.timer);
      }
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
      (key) => key !== "Cookie"
    );

    if (listOfHeaders.length > 0) {
      const configToLog = { ...config };

      macros.http(
        "Not caching by url b/c it has other headers",
        listOfHeaders,
        configToLog
      );
      return false;
    }

    const listOfConfigOptions = Object.keys(config).filter((key) =>
      CACHE_SAFE_CONFIG_OPTIONS.includes(key)
    );

    if (listOfConfigOptions.length > 0) {
      macros.http(
        "Not caching by url b/c it has other config options",
        listOfConfigOptions
      );
      return false;
    }

    return true;
  }

  /**
   * Returns the cache key for this corresponding config.
   * Allows us to cache responses from requests sent with this config
   */
  private getCacheKey(config: CustomOptions): string | undefined {
    if (this.safeToCacheByUrl(config)) {
      return config.url;
    } else {
      // Make a new request without the cookies and the cookie jar.
      const headersWithoutCookie = { ...config.headers };
      headersWithoutCookie.Cookie = undefined;

      const configToHash = { ...config };
      configToHash.headers = headersWithoutCookie;
      // TODO?? configToHash.jar = undefined;

      return objectHash(configToHash);
    }
  }

  /**
   * Sends a request
   */
  async request(config: CustomOptions): Promise<Response<string>> {
    macros.http("Request hitting", config);

    const hostname = new URI(config.url).hostname();
    this.ensureAnalyticsObject(hostname);

    let newKey: string | undefined;

    if (macros.DEV && config.cache) {
      // Skipping the hashing when it is not necessary significantly speeds this up.
      newKey = this.getCacheKey(config);

      const content = await cache.get(
        macros.REQUESTS_CACHE_DIR,
        config.cacheName,
        newKey
      );

      if (content) {
        return content as Response<string>;
      }
    }

    let tryCount = 0;

    const timeout = RETRY_DELAY + Math.round(Math.random() * RETRY_DELAY_DELTA);
    let requestDuration: number | undefined;

    return retry(
      async () => {
        tryCount++;

        try {
          const requestStart = Date.now();
          const response = await this.fireRequest(config);
          requestDuration = Date.now() - requestStart;

          this.analytics[hostname].totalGoodRequests++;

          // Save the response to a file for development
          if (macros.DEV && config.cache) {
            await cache.set(
              macros.REQUESTS_CACHE_DIR,
              config.cacheName,
              newKey,
              response.body,
              true
            );
          }

          const contentLength = Number.parseInt(
            response.headers["content-length"],
            10
          );
          this.analytics[hostname].totalBytesDownloaded += contentLength;
          if (!macros.PROD) {
            macros.http(
              `Parsed ${contentLength} in ${requestDuration} ms from ${config.url}`
            );
          }

          return response;
        } catch (err) {
          this.analytics[hostname].totalErrors++;
          if (!macros.PROD || tryCount > 5) {
            macros.error(
              `Try#: ${tryCount} Code: ${
                err.statusCode ||
                err.RequestError ||
                err.Error ||
                err.message ||
                err
              } Open request count: ${this.openRequests} Url: ${config.url}`
            );
          }

          if (err.response) {
            macros.verbose(err.response.body);
          } else {
            macros.verbose(err.message);
          }

          throw err;
        }
      },
      {
        retries: MAX_RETRY_COUNT,
        minTimeout: timeout,
        maxTimeout: timeout,
        factor: 1,
        randomize: true,
      }
    );
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
    this.config.cache ??= true;
  }

  /**
   * Sends a request to the given URL, with the given method and configuration.
   */
  private async request(
    url: string,
    config: Partial<CustomOptions>,
    method: "GET" | "POST"
  ): Promise<Response<string>> {
    config.method = method;
    config.url = url;
    // FIXME remove, break the URL out of the config. Depends on `Request`

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

    if (macros.DEV) {
      if (this.cacheName) {
        config.cacheName = this.cacheName;
      } else {
        // Parse the url hostname from the url.
        config.cacheName = new URI(config.url).hostname();
      }
    }

    return config as CustomOptions;
  }

  /**
   * Sends a GET request to the given URL, with the given configuration
   */
  async get(
    url: string,
    config?: Partial<CustomOptions>
  ): Promise<Response<string>> {
    return this.request(url, config ?? {}, "GET");
  }

  /**
   * Sends a POST request to the given URL, with the given configuration
   */
  async post(
    url: string,
    config: Partial<CustomOptions>
  ): Promise<Response<string>> {
    if (!config) {
      macros.error("Warning, request post called with no config");
      return null;
    }

    return this.request(url, config, "POST");
  }
}

export default RequestInput;
