const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CONFIG_PATH = path.resolve(__dirname, "..", "config", "clients.json");
const DEFAULT_FRONTEND_URL = "http://localhost:5173";
const DEFAULT_AUTORESTART = Object.freeze({ cooldownMs: 3000, maxAttempts: 5 });
const DEFAULT_SINGLE_DISPLAY_MODE = false;
const DEFAULT_DISPLAY_ORDER = "system";
const DEFAULT_DISPLAY_MAPPING_FILENAME = "display-mapping.json";

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

  const baseDir = path.dirname(resolvedPath);
  const frontendUrl = normalizeFrontendUrl(rawConfig.frontend_url ?? rawConfig.frontendUrl);
  const autoRestart = normalizeAutoRestart(rawConfig.auto_restart ?? rawConfig.autoRestart);
  const singleDisplayMode = normalizeSingleDisplayMode(
    rawConfig.single_display_mode ?? rawConfig.singleDisplayMode ?? rawConfig.allowSingleDisplayMode,
  );
  const displayOrder = normalizeDisplayOrder(rawConfig.display_order ?? rawConfig.displayOrder);
  const displayMappingPath = normalizeDisplayMappingPath(
    rawConfig.display_mapping_path ?? rawConfig.displayMappingPath,
    baseDir,
  );
  const clients = normalizeClients(rawConfig.clients, resolvedPath);
  applyDisplayMappingIfAvailable(clients, displayMappingPath);

  return {
    configPath: resolvedPath,
    frontendUrl,
    autoRestart,
    singleDisplayMode,
    displayOrder,
    displayMappingPath,
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

function normalizeDisplayOrder(rawValue) {
  if (typeof rawValue !== "string") {
    return DEFAULT_DISPLAY_ORDER;
  }
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "system" || normalized === "spatial") {
    return normalized;
  }
  return DEFAULT_DISPLAY_ORDER;
}

function normalizeDisplayMappingPath(rawValue, baseDir) {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    if (typeof baseDir === "string" && baseDir.trim().length > 0) {
      return path.resolve(baseDir, DEFAULT_DISPLAY_MAPPING_FILENAME);
    }
    // fallback：避免 baseDir 異常時寫到未知位置
    return path.resolve(__dirname, "..", "config", DEFAULT_DISPLAY_MAPPING_FILENAME);
  }
  const trimmed = rawValue.trim();
  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }
  return path.resolve(baseDir, trimmed);
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
  const displayId = extractDisplayId(rawClient, clientId, resolvedPath);
  const displayIndex = extractDisplayIndex(rawClient, clientId, resolvedPath);
  const fullscreen = rawClient.fullscreen !== false;
  const kiosk = Boolean(rawClient.kiosk);
  const devTools = Boolean(rawClient.devtools ?? rawClient.devTools);
  const backgroundColor = typeof rawClient.background_color === "string" ? rawClient.background_color : "#000000";
  const bounds = normalizeBounds(rawClient.bounds, resolvedPath, clientId);
  const urlParams = normalizeUrlParams(rawClient.url_params ?? rawClient.urlParams, clientId);

  return {
    clientId,
    displayId,
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

function extractDisplayId(rawClient, clientId, resolvedPath) {
  const value = rawClient.display_id ?? rawClient.displayId;
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`配置檔 ${resolvedPath} 的 client '${clientId}' display_id 必須是正整數`);
  }
  return parsed;
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

function applyDisplayMappingIfAvailable(clients, displayMappingPath) {
  if (!displayMappingPath || typeof displayMappingPath !== "string") {
    return;
  }
  if (!fs.existsSync(displayMappingPath)) {
    return;
  }

  let mappingJson;
  try {
    const raw = fs.readFileSync(displayMappingPath, "utf8");
    mappingJson = JSON.parse(raw);
  } catch (error) {
    console.warn(
      `[ConfigLoader] display mapping 讀取/解析失敗，將忽略：${displayMappingPath} (${error.message})`,
    );
    return;
  }

  const mapping = extractClientDisplayIdMapping(mappingJson);
  if (!mapping) {
    return;
  }

  for (const client of clients) {
    const entry = mapping[client.clientId];
    const displayId = extractDisplayIdFromMappingEntry(entry);
    if (Number.isInteger(displayId) && displayId > 0) {
      client.displayId = displayId;
    }
  }
}

function extractClientDisplayIdMapping(mappingJson) {
  if (!mappingJson || typeof mappingJson !== "object") {
    return null;
  }
  const candidates = [
    mappingJson.clients,
    mappingJson.mapping,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return candidate;
    }
  }
  return mappingJson;
}

function extractDisplayIdFromMappingEntry(entry) {
  if (Number.isInteger(entry) && entry > 0) {
    return entry;
  }
  if (typeof entry === "string") {
    const parsed = Number(entry);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const raw = entry.display_id ?? entry.displayId ?? entry.display;
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return null;
}

module.exports = {
  DEFAULT_CONFIG_PATH,
  loadConfig,
};
