import { CoreOptions } from "request";
import http from "http";
import https from "https";

export interface HostAnalytics {
  totalBytesDownloaded: number;
  totalErrors: number;
  totalGoodRequests: number;
  startTime: number | null;
}

export type RequestAnalytics = Record<string, HostAnalytics>;

export interface RequestPool {
  maxSockets: number;
  keepAlive: boolean;
  maxFreeSockets: number;
  "https:false:ALL"?: https.Agent;
  "http:"?: http.Agent;
}

export interface AgentAnalytics {
  socketCount: number;
  requestCount: number;
  maxSockets: number;
}

export interface CustomRequestConfig extends CoreOptions {
  url: string;
  method: string;
  cache?: boolean;
  cacheName?: string;
  headers?: Record<string, string>;
  pool?: RequestPool;
}

export type PartialRequestConfig =
  | (Partial<CustomRequestConfig> & { url: string })
  | string;

export interface NativeRequestConfig extends CustomRequestConfig {
  method: string;
  headers: Record<string, string>;
  pool: RequestPool;
  timeout: number;
  resolveWithFullResponse: boolean;
  rejectUnauthorized: boolean;
  requestCert: boolean;
  ciphers: string;
}

export type AmplitudeEvent = Partial<AgentAnalytics> & {
  totalBytesDownloaded?: number;
  totalErrors?: number;
  totalGoodRequests?: number;
  startTime?: number | null;
  hostname: string;
};

export type DoRequestReturn = { items: unknown; totalCount: number };
