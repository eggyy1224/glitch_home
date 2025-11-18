const { app, dialog } = require("electron");
const path = require("node:path");
const { loadConfig, DEFAULT_CONFIG_PATH } = require("./config-loader");
const { WindowManager } = require("./window-manager");

let windowManager = null;

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
  if (windowManager) {
    windowManager.shutdown();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
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
  app.quit();
};

process.on("SIGINT", handleSignal);
process.on("SIGTERM", handleSignal);
