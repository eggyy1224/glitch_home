import { API_BASE, buildQuery, request, withSignal } from "../utils/request";
import type { QueryValue, RequestOptions } from "../utils/request";

export interface ApiClientConfig {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
}

export interface ApiRequestOptions extends RequestOptions {
  query?: Record<string, QueryValue>;
}

function mergeHeaders(base: Record<string, string>, override: Record<string, string> = {}): Record<string, string> {
  return { ...base, ...override };
}

export function createApiClient(config: ApiClientConfig = {}) {
  const baseUrl = config.baseUrl ?? API_BASE;
  const defaultHeaders = config.defaultHeaders ?? {};

  async function requestWithQuery<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const { query, headers = {}, ...rest } = options;
    const qs = buildQuery(query || {});
    const url = qs ? `${path}${qs}` : path;
    return request<T>(url, {
      ...rest,
      baseUrl,
      headers: mergeHeaders(defaultHeaders, headers),
    });
  }

  return {
    request: requestWithQuery,
    get<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
      return requestWithQuery<T>(path, { ...options, method: "GET" });
    },
    post<T = unknown>(path: string, body?: unknown, options: ApiRequestOptions = {}): Promise<T> {
      return requestWithQuery<T>(path, { ...options, method: "POST", body });
    },
    put<T = unknown>(path: string, body?: unknown, options: ApiRequestOptions = {}): Promise<T> {
      return requestWithQuery<T>(path, { ...options, method: "PUT", body });
    },
    patch<T = unknown>(path: string, body?: unknown, options: ApiRequestOptions = {}): Promise<T> {
      return requestWithQuery<T>(path, { ...options, method: "PATCH", body });
    },
    del<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
      return requestWithQuery<T>(path, { ...options, method: "DELETE" });
    },
    withSignal,
  };
}

export const apiClient = createApiClient();
