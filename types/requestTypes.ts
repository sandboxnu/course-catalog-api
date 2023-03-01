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

// TODO Remove this/simplify the options provided
export interface CustomOptions extends OptionsOfTextResponseBody {
  url: string;
  cache?: boolean;
  cacheName?: string;
  pool?: RequestPool;
}

export type AmplitudeEvent = Partial<AgentAnalytics> & {
  totalBytesDownloaded?: number;
  totalErrors?: number;
  totalGoodRequests?: number;
  startTime?: number | null;
  hostname: string;
};

export type DoRequestReturn = { items: unknown; totalCount: number };
