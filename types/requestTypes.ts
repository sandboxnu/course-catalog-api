import { CoreOptions } from "request";

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
}

export interface AgentAnalytics {
  socketCount: number;
  requestCount: number;
  maxSockets: number;
}

export interface CustomRequestConfig extends CoreOptions {
  method: string;
  url: string;
  cache?: boolean;
  cacheName?: string;
  headers?: Record<string, string>;
  retryCount?: number;
  requiredInBody?: string[];
  shortBodyWarning?: boolean;
  pool?: RequestPool;
}

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
