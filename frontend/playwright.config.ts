import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT || 5173);
const HOST = process.env.HOST || "localhost";
const BASE_URL = process.env.BASE_URL || `http://${HOST}:${PORT}`;
const DEV_COMMAND = process.env.PLAYWRIGHT_WEB_SERVER || "npm run dev -- --host --port 5173";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: DEV_COMMAND,
    url: `http://${HOST}:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 },
      },
    },
  ],
});
