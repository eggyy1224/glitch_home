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
      <p class="subtitle">請在「控制面板」選擇這個螢幕要跑哪個 client</p>
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
        const label = payload.clientId ? payload.clientId : "（未指派）";
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
      .row { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.06); }
      .row:last-child { border-bottom: 0; }
      .label { width: 130px; font-weight: 700; }
      .meta { flex: 1; opacity: 0.75; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
      select { min-width: 240px; padding: 8px 10px; border-radius: 10px; background: #111722; color: #e8eef8; border: 1px solid rgba(255,255,255,0.12); }
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
      <div id="rows"></div>
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
        const displayIds = state.displays.map(d => d.id);

        for (const display of state.displays) {
          const row = document.createElement("div");
          row.className = "row";

          const label = document.createElement("div");
          label.className = "label";
          label.textContent = "display.id " + display.id;

          const meta = document.createElement("div");
          meta.className = "meta";
          meta.textContent = "bounds=" + JSON.stringify(display.bounds) + " scale=" + display.scaleFactor + " rotation=" + display.rotation + " internal=" + display.internal;

          const select = document.createElement("select");
          const empty = document.createElement("option");
          empty.value = "";
          empty.textContent = "（未指派）";
          select.appendChild(empty);
          for (const clientId of state.clients) {
            const opt = document.createElement("option");
            opt.value = clientId;
            opt.textContent = clientId;
            select.appendChild(opt);
          }
          select.value = state.assignmentsByDisplayId[String(display.id)] || "";
          select.addEventListener("change", () => {
            ipcRenderer.send("calibration:setAssignment", { displayId: display.id, clientId: select.value || null });
          });

          row.appendChild(label);
          row.appendChild(meta);
          row.appendChild(select);
          container.appendChild(row);
        }

        const assignedClients = new Set();
        const duplicates = [];
        for (const [displayId, clientId] of Object.entries(state.assignmentsByDisplayId)) {
          if (!clientId) continue;
          if (assignedClients.has(clientId)) duplicates.push(clientId);
          assignedClients.add(clientId);
        }
        qs("warning").textContent = duplicates.length ? ("警告：client 重複被指派：" + duplicates.join(", ")) : "";
        qs("status").textContent = "updated_at=" + (state.updatedAt || "n/a");
      }

      ipcRenderer.on("calibration:state", (_event, state) => render(state));

      async function init() {
        const state = await ipcRenderer.invoke("calibration:getState");
        render(state);
      }

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

function writeDisplayMapping(displayMappingPath, displayOrder, displays, assignmentsByDisplayId) {
  ensureDirectoryExists(displayMappingPath);
  const clients = {};
  for (const [displayIdString, clientId] of Object.entries(assignmentsByDisplayId)) {
    if (!clientId) continue;
    const displayId = Number(displayIdString);
    const display = displays.find((d) => d.id === displayId);
    clients[clientId] = {
      display_id: displayId,
      display_bounds: display?.bounds || null,
    };
  }
  const payload = {
    version: 1,
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

  const primaryDisplay = screen.getPrimaryDisplay();
  const displayMappingPath = config.displayMappingPath;
  const clients = config.clients.map((client) => client.clientId);

  const assignmentsByDisplayId = {};
  for (const display of orderedDisplays) {
    assignmentsByDisplayId[String(display.id)] = null;
  }
  // 以目前 config（可能已套用 mapping）預填
  for (const client of config.clients) {
    if (Number.isInteger(client.displayId) && client.displayId > 0) {
      const key = String(client.displayId);
      if (key in assignmentsByDisplayId) {
        assignmentsByDisplayId[key] = client.clientId;
      }
    }
  }

  const overlayWindows = new Map();

  function broadcastState(controllerWindow) {
    const state = {
      displayOrder: config.displayOrder,
      displayMappingPath,
      displays: orderedDisplays.map(serializeDisplay),
      clients,
      assignmentsByDisplayId,
      updatedAt: new Date().toISOString(),
    };
    if (controllerWindow && !controllerWindow.isDestroyed()) {
      controllerWindow.webContents.send("calibration:state", state);
    }
    for (const display of orderedDisplays) {
      const clientId = assignmentsByDisplayId[String(display.id)] || null;
      const overlay = overlayWindows.get(display.id);
      if (overlay && !overlay.isDestroyed()) {
        overlay.webContents.send("calibration:assignmentUpdated", { displayId: display.id, clientId });
      }
    }
  }

  function setAssignment(displayId, clientId) {
    const displayKey = String(displayId);
    if (!(displayKey in assignmentsByDisplayId)) {
      return;
    }
    // 若該 client 已在其他螢幕，先移除（確保 client 唯一）
    if (clientId) {
      for (const [otherDisplayId, otherClientId] of Object.entries(assignmentsByDisplayId)) {
        if (otherDisplayId !== displayKey && otherClientId === clientId) {
          assignmentsByDisplayId[otherDisplayId] = null;
        }
      }
    }
    assignmentsByDisplayId[displayKey] = clientId || null;
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
      clients,
      assignmentsByDisplayId,
      updatedAt: new Date().toISOString(),
    };
  });
  cleanupHandlers.push(() => ipcMain.removeHandler("calibration:getState"));

  on("calibration:setAssignment", (_event, payload) => {
    const displayId = payload?.displayId;
    const clientId = payload?.clientId;
    if (!Number.isInteger(displayId)) {
      return;
    }
    if (clientId !== null && clientId !== undefined && typeof clientId !== "string") {
      return;
    }
    setAssignment(displayId, clientId || null);
    broadcastState(controllerWindow);
  });

  on("calibration:finish", (_event, payload) => {
    const action = payload?.action;
    const noSave = Boolean(payload?.noSave);

    try {
      if (!noSave) {
        writeDisplayMapping(displayMappingPath, config.displayOrder, orderedDisplays, assignmentsByDisplayId);
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
