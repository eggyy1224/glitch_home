const API_BASE: string = import.meta.env.VITE_API_BASE || "";
const IMAGES_BASE: string = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";

function isAbsoluteUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

function joinUrl(base: string, path: string): string {
  if (!base || isAbsoluteUrl(path)) return path;
  if (!path) return base;
  if (base.endsWith("/") && path.startsWith("/")) {
    return `${base.slice(0, -1)}${path}`;
  }
  if (!base.endsWith("/") && !path.startsWith("/")) {
    return `${base}/${path}`;
  }
  return `${base}${path}`;
}

function formatError(status: number, detail: string): string {
  return detail ? `API ${status}: ${detail}` : `API ${status}`;
}

function extractDetail(payload: any): string {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload === "object") {
    if (typeof payload.detail === "string") return payload.detail;
    if (payload.detail && typeof payload.detail.message === "string") return payload.detail.message;
    if (typeof payload.message === "string") return payload.message;
  }
  return "";
}

export function buildImageUrl(filename: string | null, base: string = IMAGES_BASE): string | null {
  if (!filename) return null;
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${filename}`;
}

export interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal | null | undefined;
  baseUrl?: string;
  returnResponse?: boolean;
}

export interface RequestWithResponse<T = unknown> {
  data: T;
  response: Response;
}

export async function request<T = any>(
  path: string,
  options: RequestOptions & { returnResponse: true },
): Promise<RequestWithResponse<T>>;
export async function request<T = any>(path: string, options?: RequestOptions): Promise<T>;
export async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T | RequestWithResponse<T>> {
  const { method = "GET", body, headers = {}, signal, baseUrl = API_BASE, returnResponse = false } = options;
  const url = joinUrl(baseUrl, path);
  const init: RequestInit = { method, headers: { ...headers } };
  init.signal = signal ?? undefined;

  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = body;
    } else {
      (init.headers as Record<string, string>)["Content-Type"] =
        (init.headers as Record<string, string>)["Content-Type"] || "application/json";
      init.body = JSON.stringify(body);
    }
  }

  const res = await fetch(url, init);
  const contentType = res.headers?.get?.("content-type") || "";
  const isJson = contentType.includes("application/json");
  let payload;

  if (isJson) {
    try {
      payload = await res.json();
    } catch (err) {
      payload = null;
    }
  } else {
    try {
      payload = await res.text();
    } catch (err) {
      payload = "";
    }
  }

  if (!res.ok) {
    const detail = extractDetail(payload);
    throw new Error(formatError(res.status, detail));
  }

  if (returnResponse) {
    return { data: payload, response: res };
  }

  return payload;
}

export { API_BASE, IMAGES_BASE };
