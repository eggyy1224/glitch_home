const { BrowserWindow, screen } = require("electron");
const { URLSearchParams } = require("node:url");
const os = require("node:os");

const DEFAULT_BACKGROUND = "#000000";

class WindowManager {
  constructor({ frontendUrl, clients, autoRestart }) {
    this.frontendUrl = frontendUrl;
    this.clientsById = new Map();
    clients.forEach((client) => {
      this.clientsById.set(client.clientId, client);
    });

    const fallbackRestart = autoRestart || { cooldownMs: 3000, maxAttempts: 5 };
    this.autoRestart = {
      cooldownMs: fallbackRestart.cooldownMs ?? 3000,
      maxAttempts: fallbackRestart.maxAttempts ?? 5,
    };

    this.windows = new Map();
    this.windowStates = new Map();
    this.restartCounters = new Map();
    this.restartTimers = new Map();
  }

  launchAll() {
    const displays = screen.getAllDisplays();
    const displayCount = Array.isArray(displays) ? displays.length : 0;
    const singleDisplayMode = displayCount <= 1;

    for (const client of this.clientsById.values()) {
      if (singleDisplayMode && client.displayIndex > 0) {
        console.info(
          `[WindowManager] 僅偵測到 ${displayCount} 個顯示器，略過需要 display ${client.displayIndex} 的 client '${client.clientId}'`,
        );
        continue;
      }
      this.createWindow(client.clientId);
    }
  }

  createWindow(clientId) {
    const clientConfig = this.clientsById.get(clientId);
    if (!clientConfig) {
      console.error(`[WindowManager] 找不到 client '${clientId}', 取消建立視窗`);
      return null;
    }

    const existingWindow = this.windows.get(clientId);
    if (existingWindow && !existingWindow.isDestroyed()) {
      console.info(`[WindowManager] client '${clientId}' 已有視窗，略過重新建立`);
      return existingWindow;
    }

    let bounds;
    try {
      bounds = this.getBoundsForClient(clientConfig);
    } catch (error) {
      throw new Error(`[WindowManager] 無法建立 client '${clientId}': ${error.message}`);
    }
    const windowOptions = {
      title: `Player Shell - ${clientConfig.clientId}`,
      show: false,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      fullscreen: clientConfig.fullscreen !== false,
      kiosk: Boolean(clientConfig.kiosk),
      backgroundColor: clientConfig.backgroundColor || DEFAULT_BACKGROUND,
      autoHideMenuBar: true,
      useContentSize: false,
      webPreferences: {
        autoplayPolicy: "no-user-gesture-required",
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        spellcheck: false,
        backgroundThrottling: false,
      },
    };

    const window = new BrowserWindow(windowOptions);
    this.windows.set(clientId, window);
    this.windowStates.set(clientId, { suppressRestart: false });

    this.attachWindowEvents(window, clientConfig);

    const targetUrl = this.buildClientUrl(clientConfig);
    window
      .loadURL(targetUrl)
      .catch((error) => {
        console.error(`[WindowManager] 視窗 ${clientId} 載入 URL 失敗: ${error.message}`);
        this.handleWindowFailure(clientId, `load-failed: ${error.message}`);
      });

    return window;
  }

  attachWindowEvents(window, clientConfig) {
    const { clientId, devTools } = clientConfig;

    window.once("ready-to-show", () => {
      if (clientConfig.fullscreen !== false) {
        window.setFullScreen(true);
      }
      window.show();
      if (devTools) {
        window.webContents.openDevTools({ mode: "detach" });
      }
    });

    window.on("closed", () => this.handleWindowClosed(clientId));
    window.on("unresponsive", () => this.handleWindowFailure(clientId, "unresponsive"));
    window.on("minimize", () => {
      // 展演模式避免意外縮到 dock，強制回復
      window.restore();
      if (clientConfig.fullscreen !== false) {
        window.setFullScreen(true);
      }
    });

    window.webContents.on("did-finish-load", () => {
      this.restartCounters.set(clientId, 0);
    });

    window.webContents.on("did-fail-load", (event, errorCode, errorDesc, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      console.error(
        `[WindowManager] 視窗 ${clientId} did-fail-load (${errorCode}): ${errorDesc} (${validatedURL})`,
      );
      this.handleWindowFailure(clientId, `did-fail-load:${errorCode}`);
    });

    window.webContents.on("render-process-gone", (_event, details) => {
      console.error(
        `[WindowManager] 視窗 ${clientId} render-process-gone (${details.reason}) - exitCode ${details.exitCode}`,
      );
      this.handleWindowFailure(clientId, `render-process-gone:${details.reason}`);
    });

    window.webContents.on("unresponsive", () => {
      this.handleWindowFailure(clientId, "webcontents-unresponsive");
    });

    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  }

  handleWindowClosed(clientId) {
    const state = this.windowStates.get(clientId);
    this.windows.delete(clientId);
    this.windowStates.delete(clientId);

    if (state?.suppressRestart) {
      return;
    }

    this.handleWindowFailure(clientId, "closed");
  }

  handleWindowFailure(clientId, reason) {
    console.warn(`[WindowManager] 視窗 ${clientId} 遭遇異常：${reason}`);
    this.restartWindow(clientId, reason);
  }

  restartWindow(clientId, reason) {
    const clientConfig = this.clientsById.get(clientId);
    if (!clientConfig) {
      console.error(`[WindowManager] 無法重啟未知的 client '${clientId}'`);
      return;
    }

    this.destroyWindow(clientId, { suppressRestart: true });

    const attempts = (this.restartCounters.get(clientId) || 0) + 1;
    const maxAttempts = this.autoRestart.maxAttempts;
    if (Number.isFinite(maxAttempts) && attempts > maxAttempts) {
      console.error(`[WindowManager] client '${clientId}' 已達最大重啟次數 ${maxAttempts}`);
      return;
    }
    this.restartCounters.set(clientId, attempts);

    if (this.restartTimers.has(clientId)) {
      return;
    }

    const cooldown = Math.max(1000, this.autoRestart.cooldownMs || 3000);
    console.warn(`[WindowManager] 將於 ${cooldown}ms 後嘗試重啟 '${clientId}'（原因：${reason}）`);

    const timer = setTimeout(() => {
      this.restartTimers.delete(clientId);
      this.createWindow(clientId);
    }, cooldown);

    this.restartTimers.set(clientId, timer);
  }

  destroyWindow(clientId, options = {}) {
    const window = this.windows.get(clientId);
    const state = this.windowStates.get(clientId) || {};
    state.suppressRestart = Boolean(options.suppressRestart);
    this.windowStates.set(clientId, state);

    if (!window) {
      return;
    }

    this.windows.delete(clientId);
    if (!window.isDestroyed()) {
      window.destroy();
    }
  }

  shutdown() {
    for (const clientId of this.windows.keys()) {
      this.destroyWindow(clientId, { suppressRestart: true });
    }

    for (const timer of this.restartTimers.values()) {
      clearTimeout(timer);
    }
    this.restartTimers.clear();
  }

  buildClientUrl(clientConfig) {
    const searchParams = new URLSearchParams();
    const normalizedParams = clientConfig.urlParams || {};
    for (const [key, value] of Object.entries(normalizedParams)) {
      if (value === undefined || value === null) continue;
      searchParams.set(key, String(value));
    }

    if (!searchParams.has("client")) {
      searchParams.set("client", clientConfig.clientId);
    }

    const query = searchParams.toString();
    if (!query) {
      return clientConfig.directUrl || this.frontendUrl;
    }

    const hasQuery = this.frontendUrl.includes("?");
    const separator = hasQuery ? "&" : "?";
    return `${this.frontendUrl}${separator}${query}`;
  }

  getBoundsForClient(clientConfig) {
    const displays = screen.getAllDisplays();
    if (!displays || displays.length === 0) {
      throw new Error("系統沒有可用顯示器，無法建立視窗");
    }

    const displayIndex = Number(clientConfig.displayIndex);
    if (!Number.isInteger(displayIndex) || displayIndex < 0) {
      throw new Error(`client '${clientConfig.clientId}' 的 display_index 無效`);
    }
    if (displayIndex >= displays.length) {
      throw new Error(
        `client '${clientConfig.clientId}' 的 display_index=${displayIndex} 超出顯示器數量 (${displays.length})`,
      );
    }

    const targetDisplay = displays[displayIndex] || screen.getPrimaryDisplay();

    if (!targetDisplay) {
      throw new Error("找不到對應的顯示器");
    }

    const bounds = { ...targetDisplay.bounds };
    if (clientConfig.bounds) {
      bounds.width = clientConfig.bounds.width;
      bounds.height = clientConfig.bounds.height;
      if (typeof clientConfig.bounds.x === "number") bounds.x = clientConfig.bounds.x;
      if (typeof clientConfig.bounds.y === "number") bounds.y = clientConfig.bounds.y;
    }

    // macOS 全螢幕時需確保 y 座標對齊
    if (process.platform === "darwin" && bounds.y === 0 && targetDisplay.bounds.y !== 0) {
      bounds.y = targetDisplay.bounds.y;
    }

    return bounds;
  }

  focusFirstWindow() {
    for (const window of this.windows.values()) {
      if (window && !window.isDestroyed()) {
        if (window.isMinimized()) {
          window.restore();
        }
        window.focus();
        return true;
      }
    }
    return false;
  }

  shouldKeepProcessAlive() {
    if (this.clientsById.size === 0) {
      return false;
    }
    if (this.windows.size > 0) {
      return true;
    }
    return this.restartTimers.size > 0;
  }

  summary() {
    const platform = `${os.platform()} ${os.release()}`;
    const windows = [];
    for (const [clientId, window] of this.windows.entries()) {
      windows.push({ clientId, visible: window.isVisible(), isDestroyed: window.isDestroyed() });
    }
    return { platform, frontendUrl: this.frontendUrl, windows };
  }
}

module.exports = {
  WindowManager,
};
