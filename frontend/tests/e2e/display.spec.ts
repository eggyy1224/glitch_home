import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

async function fetchIframePanels(request, clientId) {
  const response = await request.get(`/api/iframe-config?client=${clientId}`);
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const panels = Array.isArray(payload?.panels) ? payload.panels : [];
  expect(panels.length).toBeGreaterThan(0);
  return panels;
}

async function expectFrameHasContent(frameLocator) {
  await expect(frameLocator.locator("body")).toBeVisible({ timeout: 20_000 });
  const childCount = await frameLocator.locator("body").evaluate((node) => node.childElementCount);
  expect(childCount).toBeGreaterThan(0);
}

const CLIENT_CASES = [
  { clientId: "desktop", sampleCount: 2 },
  { clientId: "desktop2", sampleCount: 3 },
];

for (const { clientId, sampleCount } of CLIENT_CASES) {
  test.describe(`${clientId} 顯示驗證`, () => {
    test(`渲染 iframe 版位並符合後端配置 (${clientId})`, async ({ page, request }) => {
      const panels = await fetchIframePanels(request, clientId);

      await page.goto(`/?iframe_mode=true&client=${clientId}`);

      const frames = page.locator("iframe");
      await expect(frames).toHaveCount(panels.length, { timeout: 30_000 });

      // 確認不是空態
      await expect(page.getByText("尚未設定任何 iframe 來源。")).toBeHidden({ timeout: 1_000 });

      const checks = Math.min(sampleCount, panels.length);
      for (let i = 0; i < checks; i += 1) {
        const expectedSrc = new URL(panels[i].src, BASE_URL).toString();
        const actualSrc = await frames.nth(i).evaluate((node) => node.src);
        expect(actualSrc).toBe(expectedSrc);

        const frame = page.frameLocator("iframe").nth(i);
        await expectFrameHasContent(frame);
      }
    });
  });
}
