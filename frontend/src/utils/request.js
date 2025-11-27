const API_BASE = import.meta.env.VITE_API_BASE || "";
const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";

function isAbsoluteUrl(url) {
  return /^https?:\/\//i.test(url);
}

function joinUrl(base, path) {
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

function formatError(status, detail) {
  return detail ? `API ${status}: ${detail}` : `API ${status}`;
}

function extractDetail(payload) {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload === "object") {
    if (typeof payload.detail === "string") return payload.detail;
    if (payload.detail && typeof payload.detail.message === "string") return payload.detail.message;
    if (typeof payload.message === "string") return payload.message;
  }
  return "";
}

export function buildImageUrl(filename, base = IMAGES_BASE) {
  if (!filename) return null;
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}${filename}`;
}

export async function request(path, options = {}) {
  const { method = "GET", body, headers = {}, signal, baseUrl = API_BASE, returnResponse = false } = options;
  const url = joinUrl(baseUrl, path);
  const init = { method, headers: { ...headers }, signal };

  if (body !== undefined) {
    if (body instanceof FormData) {
      init.body = body;
    } else {
      init.headers["Content-Type"] = init.headers["Content-Type"] || "application/json";
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
