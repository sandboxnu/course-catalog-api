import http from "http";
import { OptionsOfTextResponseBody, Agents } from "got";

export interface HostAnalytics {
  totalBytesDownloaded: number;
  totalErrors: number;
  totalGoodRequests: number;
  startTime: number | null;
}

export type RequestAnalytics = Record<string, HostAnalytics>;

export interface RequestPool {
  options: http.AgentOptions;
  agents: Agents | false;
}

export interface AgentAnalytics {
  socketCount: number;
  requestCount: number;
  maxSockets: number;
}

// TODO Remove this/simplify the options provided
export interface CustomOptions extends OptionsOfTextResponseBody {
  url: string;
  // defaults to true
  cacheRequests?: boolean;
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
