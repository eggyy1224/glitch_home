import { test, expect, type APIRequestContext, type FrameLocator } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

async function fetchIframePanels(request: APIRequestContext, clientId?: string | null) {
  const suffix = clientId ? `?client=${clientId}` : "";
  const response = await request.get(`/api/iframe-config${suffix}`);
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  const panels = Array.isArray(payload?.panels) ? payload.panels : [];
  expect(panels.length).toBeGreaterThan(0);
  return panels;
}

async function expectFrameHasContent(frameLocator: FrameLocator) {
  await expect(frameLocator.locator("body")).toBeVisible({ timeout: 20_000 });
  const childCount = await frameLocator
    .locator("body")
    .evaluate((node) => (node as HTMLElement).childElementCount);
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
        const actualSrc = await frames.nth(i).evaluate((node) => (node as HTMLImageElement).src);
        expect(actualSrc).toBe(expectedSrc);

        const frame = page.frameLocator("iframe").nth(i);
        await expectFrameHasContent(frame);
      }
    });
  });
}

test.describe("預設 client 顯示驗證", () => {
  test("未指定 client 仍能渲染 iframe", async ({ page, request }) => {
    const panels = await fetchIframePanels(request);

    await page.goto("/?iframe_mode=true");

    const frames = page.locator("iframe");
    await expect(frames.first()).toBeVisible({ timeout: 30_000 });
    const frameCount = await frames.count();
    expect(frameCount).toBeGreaterThan(0);
    expect(frameCount).toBeGreaterThanOrEqual(panels.length);
    await expect(page.getByText("尚未設定任何 iframe 來源。")).toBeHidden({ timeout: 1_000 });

    const checks = Math.min(2, panels.length, frameCount);
    const baseOrigin = new URL(BASE_URL).origin;
    for (let i = 0; i < checks; i += 1) {
      const actualSrc = await frames.nth(i).evaluate((node) => (node as HTMLImageElement).src);
      const actualUrl = new URL(actualSrc);
      expect(actualUrl.origin).toBe(baseOrigin);
      expect(actualUrl.pathname).toBe("/");

      const frame = page.frameLocator("iframe").nth(i);
      await expectFrameHasContent(frame);
    }
  });
});

test.describe("Collage 顯示驗證 (client=desktop)", () => {
  test("載入 collage 配置並渲染碎片", async ({ page, request }) => {
    const response = await request.get("/api/collage-config?client=desktop");
    expect(response.ok()).toBeTruthy();
    const payload = await response.json();
    const config = payload?.config ?? payload;
    const images = Array.isArray(config?.images) ? config.images : [];
    expect(images.length).toBeGreaterThan(0);

    await page.goto("/?collage_mode=true&client=desktop");

    const root = page.locator(".collage-root");
    await expect(root).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("沒有圖像可顯示")).toBeHidden({ timeout: 2_000 });

    const pieces = page.locator(".collage-piece");
    await expect(pieces.first()).toBeVisible({ timeout: 40_000 });
    const pieceCount = await pieces.count();
    expect(pieceCount).toBeGreaterThan(0);
  });
});

test.describe("Slide / Static / Video / Caption 顯示驗證", () => {
  const SAMPLE_IMAGE = "offspring_20250923_161747_194.png";
  const SAMPLE_VIDEO = "Drive_in_stormy.mp4";

  test("slide_mode 以指定圖片為起點", async ({ page }) => {
    await page.goto(`/?slide_mode=true&client=desktop&img=${SAMPLE_IMAGE}`);
    const stage = page.locator("img");
    await expect(stage.first()).toBeVisible({ timeout: 30_000 });
    await expect(stage.first()).toHaveAttribute("src", new RegExp(SAMPLE_IMAGE));
    await expect(page.getByText("尚無可播放的圖片")).toBeHidden({ timeout: 2_000 });
  });

  test("static_mode 單張靜態顯示", async ({ page }) => {
    await page.goto(`/?static_mode=true&img=${SAMPLE_IMAGE}`);
    const image = page.locator("img.static-mode-image");
    await expect(image).toBeVisible({ timeout: 10_000 });
    await expect(image).toHaveAttribute("src", new RegExp(SAMPLE_IMAGE));
  });

  test("video_mode 單畫面可見", async ({ page }) => {
    await page.goto(`/?video_mode=true&video=${SAMPLE_VIDEO}&client=desktop2-drivein`);
    const video = page.locator("video");
    await expect(video).toBeVisible({ timeout: 15_000 });
    await expect(video).toHaveAttribute("src", new RegExp(SAMPLE_VIDEO));
  });

});

test.describe("Iframe snapshot API", () => {
  test("desktop2 snapshot 列表與讀取", async ({ request }) => {
    const listResp = await request.get("/api/iframe-config/snapshots?client=desktop2");
    expect(listResp.ok()).toBeTruthy();
    const listPayload = await listResp.json();
    const snapshots = Array.isArray(listPayload?.snapshots) ? listPayload.snapshots : [];
    expect(snapshots.length).toBeGreaterThan(0);

    const snapshotName = snapshots[0]?.name;
    expect(snapshotName).toBeTruthy();

    const snapshotResp = await request.get(`/api/iframe-config/snapshots/desktop2/${snapshotName}`);
    expect(snapshotResp.ok()).toBeTruthy();
    const snapshotPayload = await snapshotResp.json();
    const panels = Array.isArray(snapshotPayload?.panels) ? snapshotPayload.panels : [];
    expect(panels.length).toBeGreaterThan(0);
    expect(snapshotPayload?.snapshot?.name || snapshotPayload?.raw?.snapshot).toBeTruthy();
  });
});
