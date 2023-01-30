import http from "http";
import https from "https";
import { OptionsOfTextResponseBody } from "got";

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

export interface CustomRequestConfig extends OptionsOfTextResponseBody {
  url: string;
  cache?: boolean;
  cacheName?: string;
  headers?: Record<string, string>;
  pool?: RequestPool;
}

// TODO remove
export type PartialRequestConfig =
  | (Partial<CustomRequestConfig> & { url: string })
  | string;

export type AmplitudeEvent = Partial<AgentAnalytics> & {
  totalBytesDownloaded?: number;
  totalErrors?: number;
  totalGoodRequests?: number;
  startTime?: number | null;
  hostname: string;
};

export type DoRequestReturn = { items: unknown; totalCount: number };
