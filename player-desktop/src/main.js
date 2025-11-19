const { app, dialog } = require("electron");
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
