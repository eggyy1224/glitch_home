const { app, dialog, ipcMain, BrowserWindow, screen } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { loadConfig, DEFAULT_CONFIG_PATH } = require("./config-loader");
const { WindowManager } = require("./window-manager");

let windowManager = null;
let explicitQuitRequested = false;
const DEFAULT_REMOTE_DEBUG_PORT = 5858;
const REMOTE_DEBUG_SWITCHES = ["--remote-debug-port", "--remote-debugging-port"];

function parseRemoteDebugPortValue(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return undefined;
  }
  const normalized = String(rawValue).trim();
  if (!normalized) {
    return undefined;
  }
  const lowered = normalized.toLowerCase();
  if (lowered === "0" || lowered === "false" || lowered === "off" || lowered === "disable") {
    return null;
  }

  const parsed = Number(normalized);
  if (Number.isFinite(parsed) && parsed > 0 && parsed < 65536) {
    return Math.floor(parsed);
  }
  console.warn(`[PlayerShell] remote-debug-port '${rawValue}' 無效，將沿用預設值 ${DEFAULT_REMOTE_DEBUG_PORT}`);
  return undefined;
}

function findRemoteDebugPortFromArgv() {
  const args = process.argv || [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    for (const variant of REMOTE_DEBUG_SWITCHES) {
      if (arg === variant) {
        const nextValue = args[i + 1];
        if (nextValue === undefined) {
          console.warn(`[PlayerShell] ${variant} 缺少埠號，忽略此參數`);
          break;
        }
        const parsed = parseRemoteDebugPortValue(nextValue);
        if (parsed === undefined) {
          console.warn(`[PlayerShell] ${variant}=${nextValue} 無效，忽略此參數`);
          break;
        }
        return parsed;
      }
      if (arg.startsWith(`${variant}=`)) {
        const valuePart = arg.slice(variant.length + 1);
        const parsed = parseRemoteDebugPortValue(valuePart);
        if (parsed === undefined) {
          console.warn(`[PlayerShell] ${variant}=${valuePart} 無效，忽略此參數`);
          break;
        }
        return parsed;
      }
    }
  }
  return undefined;
}

function resolveRemoteDebuggingPort() {
  const cliValue = findRemoteDebugPortFromArgv();
  if (cliValue !== undefined) {
    return { source: "cli", value: cliValue };
  }

  if (process.env.PLAYER_DESKTOP_REMOTE_DEBUG_PORT !== undefined) {
    const parsed = parseRemoteDebugPortValue(process.env.PLAYER_DESKTOP_REMOTE_DEBUG_PORT);
    if (parsed === null) {
      return { source: "env", value: null };
    }
    if (typeof parsed === "number") {
      return { source: "env", value: parsed };
    }
    console.warn(
      `[PlayerShell] PLAYER_DESKTOP_REMOTE_DEBUG_PORT='${process.env.PLAYER_DESKTOP_REMOTE_DEBUG_PORT}' 無效，將使用預設值`,
    );
  }

  return { source: "default", value: DEFAULT_REMOTE_DEBUG_PORT };
}

function configureRemoteDebuggingPort() {
  const resolution = resolveRemoteDebuggingPort();
  const resolvedPort = resolution?.value;
  const source = resolution?.source ?? "default";

  if (source === "cli") {
    if (resolvedPort === null) {
      console.info("[PlayerShell] remote debugging 已由 CLI 停用");
    } else {
      console.info(`[PlayerShell] remote debugging 依 CLI 設定為 127.0.0.1:${resolvedPort}`);
    }
    return;
  }

  if (resolvedPort === null) {
    const sourceLabel = source === "env" ? "環境變數" : "預設值";
    console.info(`[PlayerShell] remote debugging 已透過 ${sourceLabel} 停用`);
    return;
  }

  app.commandLine.appendSwitch("remote-debugging-port", String(resolvedPort));
  const sourceLabel = source === "env" ? "環境變數" : "預設值";
  console.info(`[PlayerShell] remote debugging port (${sourceLabel}) 已啟用：127.0.0.1:${resolvedPort}`);
}

configureRemoteDebuggingPort();

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  if (windowManager && !windowManager.focusFirstWindow()) {
    windowManager.launchAll();
  }
});

function requestAppQuit() {
  if (explicitQuitRequested) {
    return;
  }
  explicitQuitRequested = true;
  app.quit();
}

function resolveConfigPath() {
  const cliIndex = process.argv.findIndex((arg) => arg === "--config" || arg === "-c");
  if (cliIndex >= 0 && process.argv[cliIndex + 1]) {
    return path.resolve(process.argv[cliIndex + 1]);
  }

  if (process.env.PLAYER_DESKTOP_CONFIG) {
    return path.resolve(process.env.PLAYER_DESKTOP_CONFIG);
  }

  return DEFAULT_CONFIG_PATH;
}

function shouldDumpDisplays() {
  const argv = process.argv || [];
  return argv.includes("--dump-displays") || argv.includes("--dumpDisplays");
}

function shouldCalibrate() {
  const argv = process.argv || [];
  return argv.includes("--calibrate") || argv.includes("--calibration");
}

function serializeDisplay(display) {
  if (!display || typeof display !== "object") {
    return null;
  }
  return {
    id: display.id,
    bounds: display.bounds,
    workArea: display.workArea,
    scaleFactor: display.scaleFactor,
    rotation: display.rotation,
    internal: display.internal,
  };
}

function sortDisplaysSpatial(displays) {
  return [...displays].sort((a, b) => {
    const ax = a?.bounds?.x ?? 0;
    const bx = b?.bounds?.x ?? 0;
    if (ax !== bx) return ax - bx;
    const ay = a?.bounds?.y ?? 0;
    const by = b?.bounds?.y ?? 0;
    if (ay !== by) return ay - by;
    return (a?.id ?? 0) - (b?.id ?? 0);
  });
}

function getOrderedDisplays(displayOrder) {
  const systemOrder = screen.getAllDisplays();
  if (!Array.isArray(systemOrder)) {
    return [];
  }
  if (displayOrder === "spatial") {
    return sortDisplaysSpatial(systemOrder);
  }
  return systemOrder;
}

function dumpDisplays() {
  const systemOrder = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const spatialOrder = sortDisplaysSpatial(systemOrder);
  const payload = {
    primary: serializeDisplay(primary),
    systemOrder: systemOrder.map(serializeDisplay),
    spatialOrder: spatialOrder.map(serializeDisplay),
  };
  console.info(JSON.stringify(payload, null, 2));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildOverlayHtml(display) {
  const bounds = display?.bounds || {};
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Display Overlay</title>
    <style>
      :root { color-scheme: dark; }
      html, body { height: 100%; margin: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "PingFang TC", "Microsoft JhengHei", sans-serif;
        background: rgba(0,0,0,0.75);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .card {
        width: min(1100px, calc(100vw - 120px));
        border: 2px solid rgba(255,255,255,0.2);
        border-radius: 24px;
        padding: 40px;
        background: rgba(0,0,0,0.45);
        box-shadow: 0 30px 80px rgba(0,0,0,0.45);
      }
      .title { font-size: 64px; font-weight: 800; letter-spacing: 0.5px; margin: 0 0 18px; }
      .subtitle { font-size: 26px; opacity: 0.9; margin: 0 0 28px; }
      .meta { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 20px; opacity: 0.9; line-height: 1.55; }
      .assigned { margin-top: 28px; font-size: 44px; font-weight: 750; }
      .assigned span { color: #7CFFB2; }
      .hint { margin-top: 18px; font-size: 20px; opacity: 0.75; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1 class="title">螢幕校正模式</h1>
      <p class="subtitle">請在「控制面板」把輸出槽位與前端 preset 指派到這個螢幕（可多螢幕組合）</p>
      <div class="meta">
        display.id = ${escapeHtml(display?.id)}<br />
        bounds = ${escapeHtml(JSON.stringify(bounds))}<br />
        scaleFactor = ${escapeHtml(display?.scaleFactor)} / rotation = ${escapeHtml(display?.rotation)} / internal = ${escapeHtml(display?.internal)}
      </div>
      <div class="assigned">已指派：<span id="assigned">（未指派）</span></div>
      <div class="hint">（這個畫面是 overlay，不會吃滑鼠點擊；完成後按控制面板的 Save &amp; Launch）</div>
    </div>
    <script>
      const { ipcRenderer } = require("electron");
      const displayId = ${JSON.stringify(display?.id)};
      ipcRenderer.on("calibration:assignmentUpdated", (_event, payload) => {
        if (!payload || payload.displayId !== displayId) return;
        const label = payload.label ? payload.label : "（未指派）";
        document.getElementById("assigned").textContent = label;
      });
    </script>
  </body>
</html>`;
}

function buildControllerHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Calibration Controller</title>
    <style>
      :root { color-scheme: dark; }
      html, body { height: 100%; margin: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "PingFang TC", "Microsoft JhengHei", sans-serif;
        background: #0b0e12;
        color: #e8eef8;
      }
      header { padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; gap: 12px; align-items: center; }
      header h1 { font-size: 18px; margin: 0; font-weight: 700; letter-spacing: 0.4px; }
      header .path { opacity: 0.7; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
      main { padding: 18px 20px 24px; }
      .toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
      .rows { border: 1px solid rgba(255,255,255,0.10); border-radius: 14px; overflow: hidden; }
      .row { display: grid; grid-template-columns: 180px 220px 1fr; gap: 12px; align-items: start; padding: 12px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); }
      .row:last-child { border-bottom: 0; }
      .label { font-weight: 800; letter-spacing: 0.2px; }
      .label .sub { margin-top: 6px; font-weight: 600; opacity: 0.7; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .preset { display: flex; flex-direction: column; gap: 8px; }
      .preset select { width: 100%; }
      .preset .hint { opacity: 0.7; font-size: 12px; line-height: 1.35; }
      .displays { display: flex; flex-wrap: wrap; gap: 10px 12px; }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(17,23,34,0.9);
      }
      .chip input { transform: translateY(0.5px); }
      .chip .meta { opacity: 0.7; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      select { padding: 8px 10px; border-radius: 10px; background: #111722; color: #e8eef8; border: 1px solid rgba(255,255,255,0.12); }
      .actions { margin-top: 16px; display: flex; gap: 10px; }
      button {
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.14);
        background: #111722;
        color: #e8eef8;
        cursor: pointer;
        font-weight: 700;
      }
      button.primary { background: #2f6bff; border-color: rgba(47,107,255,0.6); }
      button.danger { background: #b42318; border-color: rgba(180,35,24,0.6); }
      .status { margin-top: 12px; opacity: 0.8; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .warning { margin-top: 12px; color: #ffd37a; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    </style>
  </head>
  <body>
    <header>
      <h1>Player Desktop — 螢幕校正控制面板</h1>
      <div class="path" id="mappingPath"></div>
    </header>
    <main>
      <div class="toolbar">
        <button id="autoAssign">Auto assign（依顯示器排序）</button>
        <button id="clearAll">Clear all</button>
      </div>
      <div class="rows" id="rows"></div>
      <div class="actions">
        <button class="primary" id="saveLaunch">Save &amp; Launch</button>
        <button id="saveExit">Save &amp; Exit</button>
        <button class="danger" id="exitNoSave">Exit (no save)</button>
      </div>
      <div class="status" id="status">loading…</div>
      <div class="warning" id="warning"></div>
    </main>
    <script>
      const { ipcRenderer } = require("electron");

      function qs(id) { return document.getElementById(id); }

      function render(state) {
        qs("mappingPath").textContent = state.displayMappingPath || "";
        const container = qs("rows");
        container.innerHTML = "";
        const presetIds = state.presetIds || [];

        for (const slot of state.slots || []) {
          const row = document.createElement("div");
          row.className = "row";

          const label = document.createElement("div");
          label.className = "label";
          label.textContent = slot.slotId;
          const sub = document.createElement("div");
          sub.className = "sub";
          sub.textContent = "output slot (clients[].client_id)";
          label.appendChild(sub);

          const preset = document.createElement("div");
          preset.className = "preset";
          const presetSelect = document.createElement("select");
          const emptyPreset = document.createElement("option");
          emptyPreset.value = "";
          emptyPreset.textContent = "（維持原本 url_params）";
          presetSelect.appendChild(emptyPreset);
          for (const presetId of presetIds) {
            const opt = document.createElement("option");
            opt.value = presetId;
            opt.textContent = presetId;
            presetSelect.appendChild(opt);
          }
          presetSelect.value = slot.presetId || "";
          presetSelect.addEventListener("change", () => {
            ipcRenderer.send("calibration:setSlotPreset", { slotId: slot.slotId, presetId: presetSelect.value || null });
          });
          const presetHint = document.createElement("div");
          presetHint.className = "hint";
          presetHint.textContent = "對應你說的 ?iframe_mode=true&client=desktopX；未來可擴充更多參數。";
          preset.appendChild(presetSelect);
          preset.appendChild(presetHint);

          const displays = document.createElement("div");
          displays.className = "displays";
          for (const display of state.displays || []) {
            const chip = document.createElement("label");
            chip.className = "chip";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = (slot.displayIds || []).includes(display.id);
            checkbox.addEventListener("change", () => {
              ipcRenderer.send("calibration:toggleSlotDisplay", {
                slotId: slot.slotId,
                displayId: display.id,
                checked: checkbox.checked,
              });
            });
            const text = document.createElement("div");
            text.innerHTML = "<div><strong>display.id " + display.id + "</strong></div>" +
              "<div class='meta'>bounds=" + JSON.stringify(display.bounds) + "</div>";
            chip.appendChild(checkbox);
            chip.appendChild(text);
            displays.appendChild(chip);
          }

          row.appendChild(label);
          row.appendChild(preset);
          row.appendChild(displays);
          container.appendChild(row);
        }

        qs("warning").textContent = state.warning || "";
        qs("status").textContent = "updated_at=" + (state.updatedAt || "n/a");
      }

      ipcRenderer.on("calibration:state", (_event, state) => render(state));

      async function init() {
        const state = await ipcRenderer.invoke("calibration:getState");
        render(state);
      }

      qs("autoAssign").addEventListener("click", () => ipcRenderer.send("calibration:autoAssign"));
      qs("clearAll").addEventListener("click", () => ipcRenderer.send("calibration:clearAll"));
      qs("saveLaunch").addEventListener("click", () => ipcRenderer.send("calibration:finish", { action: "launch" }));
      qs("saveExit").addEventListener("click", () => ipcRenderer.send("calibration:finish", { action: "exit" }));
      qs("exitNoSave").addEventListener("click", () => ipcRenderer.send("calibration:finish", { action: "exit", noSave: true }));

      init().catch((err) => {
        qs("status").textContent = "init failed: " + (err && err.message ? err.message : String(err));
      });
    </script>
  </body>
</html>`;
}

function ensureDirectoryExists(filePath) {
  const dir = path.dirname(filePath);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    throw new Error(`無法建立資料夾 ${dir}: ${error.message}`);
  }
}

function resolvePresetUrlParams(presetId, clientPresets) {
  if (!presetId) {
    return null;
  }
  if (clientPresets && typeof clientPresets === "object") {
    const preset = clientPresets[presetId];
    if (preset && typeof preset === "object") {
      const normalized = {};
      for (const [key, value] of Object.entries(preset)) {
        if (value === undefined || value === null) continue;
        normalized[key] = String(value);
      }
      return normalized;
    }
  }
  // fallback：若沒有 presets 定義，就用 client=presetId
  return { client: String(presetId) };
}

function writeDisplayMapping(displayMappingPath, displayOrder, displays, slotsById, clientPresets, baseUrlParamsBySlotId) {
  ensureDirectoryExists(displayMappingPath);
  const clients = {};
  for (const [slotId, slot] of Object.entries(slotsById || {})) {
    const entry = {};
    const displayIds = Array.isArray(slot?.displayIds) ? slot.displayIds.filter((id) => Number.isInteger(id) && id > 0) : [];
    if (displayIds.length > 0) {
      entry.display_ids = displayIds;
      if (displayIds.length === 1) {
        entry.display_id = displayIds[0];
      }
    }

    const presetId = slot?.presetId ? String(slot.presetId) : "";
    if (presetId) {
      entry.preset_id = presetId;
    }

    const baseParams = (baseUrlParamsBySlotId && baseUrlParamsBySlotId[slotId]) ? baseUrlParamsBySlotId[slotId] : {};
    const presetParams = resolvePresetUrlParams(presetId, clientPresets) || {};
    const resolvedParams = { ...(baseParams || {}), ...(presetParams || {}) };
    if (Object.keys(resolvedParams).length > 0) {
      entry.url_params = resolvedParams;
    }

    clients[slotId] = entry;
  }
  const payload = {
    version: 2,
    updated_at: new Date().toISOString(),
    display_order: displayOrder,
    displays: displays.map(serializeDisplay),
    clients,
  };
  fs.writeFileSync(displayMappingPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function runCalibration() {
  let config;
  try {
    const configPath = resolveConfigPath();
    config = loadConfig(configPath);
  } catch (error) {
    reportFatalError(error);
    return;
  }

  const orderedDisplays = getOrderedDisplays(config.displayOrder);
  if (orderedDisplays.length === 0) {
    reportFatalError(new Error("偵測不到任何顯示器，無法進行校正"));
    return;
  }

  const displayMappingPath = config.displayMappingPath;
  const slots = config.clients.map((client) => client.clientId);
  const baseUrlParamsBySlotId = {};
  for (const client of config.clients) {
    baseUrlParamsBySlotId[client.clientId] = client.urlParams || {};
  }

  const presetIdsFromConfig = config.clientPresets && typeof config.clientPresets === "object"
    ? Object.keys(config.clientPresets)
    : [];
  const derivedPresetIds = Array.from(
    new Set(config.clients.map((client) => String(client.urlParams?.client || "").trim()).filter(Boolean)),
  );
  const presetIds = presetIdsFromConfig.length ? presetIdsFromConfig : derivedPresetIds;
  presetIds.sort((a, b) => {
    const ax = String(a);
    const bx = String(b);
    const am = ax.match(/^(.*?)(\d+)$/);
    const bm = bx.match(/^(.*?)(\d+)$/);
    if (am && bm && am[1] === bm[1]) {
      const an = Number(am[2]);
      const bn = Number(bm[2]);
      if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) {
        return an - bn;
      }
    }
    return ax.localeCompare(bx, "en", { numeric: true, sensitivity: "base" });
  });

  const slotsById = {};
  for (const slotClient of config.clients) {
    const slotId = slotClient.clientId;
    const presetId = String(slotClient.urlParams?.client || "").trim();
    let displayIds = [];
    if (Array.isArray(slotClient.displayIds) && slotClient.displayIds.length > 0) {
      displayIds = slotClient.displayIds.filter((id) => Number.isInteger(id) && id > 0);
    } else if (Number.isInteger(slotClient.displayId) && slotClient.displayId > 0) {
      displayIds = [slotClient.displayId];
    } else {
      const fallbackDisplay = orderedDisplays[slotClient.displayIndex];
      if (fallbackDisplay) {
        displayIds = [fallbackDisplay.id];
      }
    }
    slotsById[slotId] = { displayIds, presetId: presetIds.includes(presetId) ? presetId : "" };
  }

  // 避免同一 display 被多個 slot 佔用：先到先得
  const claimedDisplays = new Set();
  for (const slotId of slots) {
    const slot = slotsById[slotId];
    const unique = [];
    for (const displayId of slot.displayIds || []) {
      if (claimedDisplays.has(displayId)) continue;
      claimedDisplays.add(displayId);
      unique.push(displayId);
    }
    slot.displayIds = unique;
  }

  const overlayWindows = new Map();

  function broadcastState(controllerWindow) {
    const warnings = [];
    const used = new Set();
    for (const slotId of slots) {
      const slot = slotsById[slotId];
      const ids = slot?.displayIds || [];
      if (ids.length === 0) {
        warnings.push(`slot '${slotId}' 尚未指派任何 display`);
      }
      for (const id of ids) {
        if (used.has(id)) {
          warnings.push(`display.id ${id} 被重複指派（請檢查）`);
        }
        used.add(id);
      }
    }

    const state = {
      displayOrder: config.displayOrder,
      displayMappingPath,
      displays: orderedDisplays.map(serializeDisplay),
      presetIds,
      slots: slots.map((slotId) => ({
        slotId,
        displayIds: slotsById[slotId]?.displayIds || [],
        presetId: slotsById[slotId]?.presetId || "",
      })),
      warning: warnings.join(" / "),
      updatedAt: new Date().toISOString(),
    };
    if (controllerWindow && !controllerWindow.isDestroyed()) {
      controllerWindow.webContents.send("calibration:state", state);
    }
    for (const display of orderedDisplays) {
      let label = null;
      for (const slotId of slots) {
        const slot = slotsById[slotId];
        if (Array.isArray(slot?.displayIds) && slot.displayIds.includes(display.id)) {
          label = slot.presetId ? `${slotId} / ${slot.presetId}` : slotId;
          break;
        }
      }
      const overlay = overlayWindows.get(display.id);
      if (overlay && !overlay.isDestroyed()) {
        overlay.webContents.send("calibration:assignmentUpdated", { displayId: display.id, label });
      }
    }
  }

  function toggleSlotDisplay(slotId, displayId, checked) {
    const slot = slotsById[slotId];
    if (!slot) {
      return;
    }
    const id = Number(displayId);
    if (!Number.isInteger(id) || id <= 0) {
      return;
    }

    const current = new Set(slot.displayIds || []);
    if (checked) {
      // display 只能屬於一個 slot：先從其他 slot 移除
      for (const otherSlotId of slots) {
        if (otherSlotId === slotId) continue;
        const other = slotsById[otherSlotId];
        if (!other) continue;
        other.displayIds = (other.displayIds || []).filter((entry) => entry !== id);
      }
      current.add(id);
    } else {
      current.delete(id);
    }
    slot.displayIds = Array.from(current);
  }

  function setSlotPreset(slotId, presetId) {
    const slot = slotsById[slotId];
    if (!slot) return;
    const normalized = presetId ? String(presetId).trim() : "";
    slot.presetId = normalized;
  }

  function autoAssignSlots() {
    const orderedIds = orderedDisplays.map((d) => d.id);
    for (const slotId of slots) {
      slotsById[slotId].displayIds = [];
    }
    for (let i = 0; i < slots.length; i += 1) {
      const slotId = slots[i];
      const displayId = orderedIds[i];
      if (displayId === undefined) {
        break;
      }
      slotsById[slotId].displayIds = [displayId];
    }
  }

  function clearAllAssignments() {
    for (const slotId of slots) {
      slotsById[slotId].displayIds = [];
    }
  }

  for (const display of orderedDisplays) {
    const overlayWindow = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      show: false,
      fullscreen: true,
      transparent: true,
      backgroundColor: "#00000000",
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        sandbox: false,
        backgroundThrottling: false,
      },
    });
    overlayWindow.setIgnoreMouseEvents(true);
    overlayWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildOverlayHtml(display))}`);
    overlayWindow.once("ready-to-show", () => {
      overlayWindow.showInactive();
    });
    overlayWindows.set(display.id, overlayWindow);
  }

  const controllerWindow = new BrowserWindow({
    width: 980,
    height: 720,
    title: "Player Desktop Calibration",
    backgroundColor: "#0b0e12",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  controllerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildControllerHtml())}`);

  const cleanupHandlers = [];
  function on(event, handler) {
    ipcMain.on(event, handler);
    cleanupHandlers.push(() => ipcMain.removeListener(event, handler));
  }
  ipcMain.handle("calibration:getState", async () => {
    return {
      displayOrder: config.displayOrder,
      displayMappingPath,
      displays: orderedDisplays.map(serializeDisplay),
      presetIds,
      slots: slots.map((slotId) => ({
        slotId,
        displayIds: slotsById[slotId]?.displayIds || [],
        presetId: slotsById[slotId]?.presetId || "",
      })),
      updatedAt: new Date().toISOString(),
    };
  });
  cleanupHandlers.push(() => ipcMain.removeHandler("calibration:getState"));

  on("calibration:toggleSlotDisplay", (_event, payload) => {
    const slotId = payload?.slotId;
    const displayId = payload?.displayId;
    const checked = Boolean(payload?.checked);
    if (typeof slotId !== "string" || !slotId) return;
    toggleSlotDisplay(slotId, displayId, checked);
    broadcastState(controllerWindow);
  });

  on("calibration:setSlotPreset", (_event, payload) => {
    const slotId = payload?.slotId;
    const presetId = payload?.presetId;
    if (typeof slotId !== "string" || !slotId) return;
    if (presetId !== null && presetId !== undefined && typeof presetId !== "string") return;
    setSlotPreset(slotId, presetId || "");
    broadcastState(controllerWindow);
  });

  on("calibration:autoAssign", () => {
    autoAssignSlots();
    broadcastState(controllerWindow);
  });

  on("calibration:clearAll", () => {
    clearAllAssignments();
    broadcastState(controllerWindow);
  });

  on("calibration:finish", (_event, payload) => {
    const action = payload?.action;
    const noSave = Boolean(payload?.noSave);

    try {
      if (!noSave) {
        writeDisplayMapping(
          displayMappingPath,
          config.displayOrder,
          orderedDisplays,
          slotsById,
          config.clientPresets,
          baseUrlParamsBySlotId,
        );
        console.info(`[PlayerShell] display mapping 已寫入：${displayMappingPath}`);
      }
    } catch (error) {
      dialog.showErrorBox("Calibration", `寫入 mapping 失敗：${error.message}`);
      return;
    }

    // 關掉校正視窗
    for (const overlayWindow of overlayWindows.values()) {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.close();
      }
    }
    if (!controllerWindow.isDestroyed()) {
      controllerWindow.close();
    }
    for (const cleanup of cleanupHandlers) {
      cleanup();
    }

    if (action === "launch") {
      bootstrap();
      return;
    }
    requestAppQuit();
  });

  controllerWindow.on("closed", () => {
    // 使用者關掉控制面板就視為結束
    for (const overlayWindow of overlayWindows.values()) {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.close();
      }
    }
    for (const cleanup of cleanupHandlers) {
      cleanup();
    }
    requestAppQuit();
  });

  broadcastState(controllerWindow);
}

function bootstrap() {
  try {
    const configPath = resolveConfigPath();
    const config = loadConfig(configPath);
    windowManager = new WindowManager(config);
    windowManager.launchAll();
    console.info(`[PlayerShell] 已載入配置 ${config.configPath}`);
  } catch (error) {
    reportFatalError(error);
  }
}

function reportFatalError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[PlayerShell] 初始化失敗: ${message}`);
  if (error?.stack) {
    console.error(error.stack);
  }
  dialog.showErrorBox("Player Desktop Shell", `啟動失敗：${message}`);
  app.exit(1);
}

app.whenReady().then(() => {
  if (shouldDumpDisplays()) {
    dumpDisplays();
    app.exit(0);
    return;
  }
  if (shouldCalibrate()) {
    runCalibration();
    return;
  }
  bootstrap();

  app.on("activate", () => {
    if (windowManager && windowManager.windows?.size === 0) {
      windowManager.launchAll();
    }
  });
});

app.on("before-quit", () => {
  explicitQuitRequested = true;
  if (windowManager) {
    windowManager.shutdown();
  }
});

app.on("window-all-closed", () => {
  if (process.platform === "darwin") {
    return;
  }

  if (explicitQuitRequested) {
    return;
  }

  if (windowManager?.shouldKeepProcessAlive()) {
    console.info("[PlayerShell] 所有視窗已暫時關閉，等待自動重啟");
    return;
  }

  requestAppQuit();
});

app.on("child-process-gone", (_event, details) => {
  console.error(
    `[PlayerShell] 子程序 (${details.type}) 終止，原因=${details.reason}, exitCode=${details.exitCode}`,
  );
});

process.on("uncaughtException", (error) => {
  console.error("[PlayerShell] 未捕捉例外", error);
  dialog.showErrorBox("Player Desktop Shell", `未捕捉例外：${error.message}`);
});

process.on("unhandledRejection", (reason) => {
  console.error("[PlayerShell] 未處理的 Promise 拒絕", reason);
});

const handleSignal = (signal) => {
  console.info(`[PlayerShell] 接收到訊號 ${signal}，準備結束應用`);
  requestAppQuit();
};

process.on("SIGINT", handleSignal);
process.on("SIGTERM", handleSignal);
