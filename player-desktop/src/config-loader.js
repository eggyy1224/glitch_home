const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CONFIG_PATH = path.resolve(__dirname, "..", "config", "clients.json");
const DEFAULT_FRONTEND_URL = "http://localhost:5173";
const DEFAULT_AUTORESTART = Object.freeze({ cooldownMs: 3000, maxAttempts: 5 });
const DEFAULT_SINGLE_DISPLAY_MODE = false;

function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  const resolvedPath = path.resolve(configPath);
  const fileContents = readConfigFile(resolvedPath);
  const parsed = parseConfigJson(fileContents, resolvedPath);
  return normalizeConfig(parsed, resolvedPath);
}

function readConfigFile(resolvedPath) {
  try {
    return fs.readFileSync(resolvedPath, "utf8");
  } catch (error) {
    const message = `無法讀取配置檔 ${resolvedPath}: ${error.message}`;
    throw new Error(message);
  }
}

function parseConfigJson(rawJson, resolvedPath) {
  try {
    return JSON.parse(rawJson);
  } catch (error) {
    const message = `配置檔 ${resolvedPath} JSON 解析失敗: ${error.message}`;
    throw new Error(message);
  }
}

function normalizeConfig(rawConfig, resolvedPath) {
  if (!rawConfig || typeof rawConfig !== "object") {
    throw new Error(`配置檔 ${resolvedPath} 格式錯誤：必須是 JSON 物件`);
  }

  const frontendUrl = normalizeFrontendUrl(rawConfig.frontend_url ?? rawConfig.frontendUrl);
  const autoRestart = normalizeAutoRestart(rawConfig.auto_restart ?? rawConfig.autoRestart);
  const singleDisplayMode = normalizeSingleDisplayMode(
    rawConfig.single_display_mode ?? rawConfig.singleDisplayMode ?? rawConfig.allowSingleDisplayMode,
  );
  const clients = normalizeClients(rawConfig.clients, resolvedPath);

  return {
    configPath: resolvedPath,
    frontendUrl,
    autoRestart,
    singleDisplayMode,
    clients,
  };
}

function normalizeFrontendUrl(urlValue) {
  if (typeof urlValue === "string" && urlValue.trim().length > 0) {
    return urlValue.trim();
  }
  return DEFAULT_FRONTEND_URL;
}

function normalizeAutoRestart(autoRestartValue) {
  if (!autoRestartValue || typeof autoRestartValue !== "object") {
    return { ...DEFAULT_AUTORESTART };
  }

  const cooldown = Number(autoRestartValue.cooldown_ms ?? autoRestartValue.cooldownMs);
  const maxAttempts = Number(autoRestartValue.max_attempts ?? autoRestartValue.maxAttempts);

  return {
    cooldownMs: Number.isFinite(cooldown) && cooldown > 0 ? Math.round(cooldown) : DEFAULT_AUTORESTART.cooldownMs,
    maxAttempts: Number.isFinite(maxAttempts) && maxAttempts > 0 ? Math.round(maxAttempts) : DEFAULT_AUTORESTART.maxAttempts,
  };
}

function normalizeSingleDisplayMode(rawValue) {
  if (typeof rawValue === "boolean") {
    return rawValue;
  }
  if (rawValue === 1 || rawValue === "1" || rawValue === "true") {
    return true;
  }
  if (rawValue === 0 || rawValue === "0" || rawValue === "false") {
    return false;
  }
  return DEFAULT_SINGLE_DISPLAY_MODE;
}

function normalizeClients(clientsValue, resolvedPath) {
  if (!Array.isArray(clientsValue) || clientsValue.length === 0) {
    throw new Error(`配置檔 ${resolvedPath} 必須包含至少一個 clients 項目`);
  }

  const normalized = clientsValue.map((clientConfig, index) => normalizeClient(clientConfig, index, resolvedPath));
  ensureUniqueClientIds(normalized, resolvedPath);
  return normalized;
}

function normalizeClient(rawClient, index, resolvedPath) {
  if (!rawClient || typeof rawClient !== "object") {
    throw new Error(`配置檔 ${resolvedPath} 的 clients[${index}] 不是有效的物件`);
  }

  const clientId = extractClientId(rawClient, index);
  const displayIndex = extractDisplayIndex(rawClient, clientId, resolvedPath);
  const fullscreen = rawClient.fullscreen !== false;
  const kiosk = Boolean(rawClient.kiosk);
  const devTools = Boolean(rawClient.devtools ?? rawClient.devTools);
  const backgroundColor = typeof rawClient.background_color === "string" ? rawClient.background_color : "#000000";
  const bounds = normalizeBounds(rawClient.bounds, resolvedPath, clientId);
  const urlParams = normalizeUrlParams(rawClient.url_params ?? rawClient.urlParams, clientId);

  return {
    clientId,
    displayIndex,
    fullscreen,
    kiosk,
    devTools,
    backgroundColor,
    bounds,
    urlParams,
  };
}

function extractClientId(rawClient, index) {
  if (typeof rawClient.client_id === "string" && rawClient.client_id.trim().length > 0) {
    return rawClient.client_id.trim();
  }
  if (typeof rawClient.clientId === "string" && rawClient.clientId.trim().length > 0) {
    return rawClient.clientId.trim();
  }
  return `client-${index}`;
}

function extractDisplayIndex(rawClient, clientId, resolvedPath) {
  const value = rawClient.display_index ?? rawClient.displayIndex;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`配置檔 ${resolvedPath} 的 client '${clientId}' 缺少合法的 display_index`);
  }
  return value;
}

function normalizeBounds(boundsValue, resolvedPath, clientId) {
  if (!boundsValue) {
    return null;
  }
  if (typeof boundsValue !== "object") {
    throw new Error(`配置檔 ${resolvedPath} 的 client '${clientId}' bounds 必須是物件`);
  }

  const width = Number(boundsValue.width);
  const height = Number(boundsValue.height);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`配置檔 ${resolvedPath} 的 client '${clientId}' bounds.width / bounds.height 必須是數字`);
  }

  const x = Number.isFinite(boundsValue.x) ? Number(boundsValue.x) : undefined;
  const y = Number.isFinite(boundsValue.y) ? Number(boundsValue.y) : undefined;

  return { width, height, x, y };
}

function normalizeUrlParams(urlParamsValue, clientId) {
  if (!urlParamsValue || typeof urlParamsValue !== "object") {
    return { client: clientId };
  }

  const params = {};
  for (const [key, value] of Object.entries(urlParamsValue)) {
    if (value === undefined || value === null) continue;
    params[key] = String(value);
  }

  if (!params.client) {
    params.client = clientId;
  }

  return params;
}

function ensureUniqueClientIds(clients, resolvedPath) {
  const seen = new Set();
  for (const client of clients) {
    if (seen.has(client.clientId)) {
      throw new Error(`配置檔 ${resolvedPath} 存在重複的 client_id '${client.clientId}'`);
    }
    seen.add(client.clientId);
  }
}

module.exports = {
  DEFAULT_CONFIG_PATH,
  loadConfig,
};
