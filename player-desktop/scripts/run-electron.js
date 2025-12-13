"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const electron = require("electron");
if (typeof electron !== "string") {
  console.error("[PlayerShell] scripts/run-electron.js 必須由 Node.js 執行（不要用 Electron 啟動）。");
  process.exit(1);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const appPath = path.resolve(__dirname, "..");
const child = spawn(electron, [appPath, ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
});

child.on("error", (error) => {
  console.error(`[PlayerShell] 無法啟動 Electron：${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

