import fs from "node:fs/promises";
import path from "node:path";
import { test, expect, type APIRequestContext, type Browser, type FrameLocator, type Page } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";
const METADATA_DIR =
  process.env.METADATA_DIR && path.isAbsolute(process.env.METADATA_DIR)
    ? process.env.METADATA_DIR
    : path.resolve(process.cwd(), "../backend/metadata");
const IMAGE_A = "offspring_20250923_161747_194.png";
const IMAGE_B = "offspring_20250923_161828_524.png";
const IMAGE_C = "offspring_20250923_161624_066.png";

const createdFiles = new Set<string>();
const createdDirs = new Set<string>();

const makeClientId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`;

const absoluteSrc = (src: string) => new URL(src, BASE_URL).toString();

async function cleanupArtifacts() {
  for (const file of createdFiles) {
    try {
      await fs.rm(file, { force: true });
    } catch {
      // ignore cleanup error
    }
  }
  const dirs = Array.from(createdDirs).sort((a, b) => b.length - a.length);
  for (const dir of dirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  }
}

async function expectFrameHasContent(frameLocator: FrameLocator) {
  await expect(frameLocator.locator("body")).toBeVisible({ timeout: 20_000 });
  const childCount = await frameLocator.locator("body").evaluate((node) => (node as HTMLElement).childElementCount);
  expect(childCount).toBeGreaterThan(0);
}

async function setIframeConfig(
  request: APIRequestContext,
  clientId: string,
  panels: Array<{ id: string; url: string; ratio?: number; label?: string }>,
  overrides: Record<string, unknown> = {},
) {
  const payload = {
    target_client_id: clientId,
    layout: "grid",
    gap: 10,
    columns: Math.max(1, Math.min(4, panels.length)),
    panels,
    ...overrides,
  };
  const resp = await request.put("/api/iframe-config", {
    data: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
  expect(resp.ok()).toBeTruthy();
  createdFiles.add(path.join(METADATA_DIR, `iframe_config__${clientId}.json`));
  return resp.json();
}

async function snapshotIframeConfig(request: APIRequestContext, clientId: string, note: string) {
  const resp = await request.post("/api/iframe-config/snapshot", {
    data: JSON.stringify({ client_id: clientId, snapshot_name: note }),
    headers: { "Content-Type": "application/json" },
  });
  expect(resp.ok()).toBeTruthy();
  const payload = await resp.json();
  const snapshotName = payload?.snapshot?.name;
  expect(typeof snapshotName).toBe("string");
  createdFiles.add(path.join(METADATA_DIR, "snapshots", "iframe_config", clientId, `${snapshotName}.json`));
  createdDirs.add(path.join(METADATA_DIR, "snapshots", "iframe_config", clientId));
  return snapshotName as string;
}

async function restoreIframeConfig(request: APIRequestContext, clientId: string, snapshotName: string) {
  const resp = await request.post("/api/iframe-config/restore", {
    data: JSON.stringify({ client_id: clientId, snapshot_name: snapshotName }),
    headers: { "Content-Type": "application/json" },
  });
  expect(resp.ok()).toBeTruthy();
  return resp.json();
}

async function setCollageConfig(
  request: APIRequestContext,
  clientId: string,
  config: Partial<{
    rows: number;
    cols: number;
    images: string[];
    mix: boolean;
    seed: number;
    stage_width: number;
    stage_height: number;
  }> = {},
) {
  const images = config.images ?? [IMAGE_A];
  const payload = {
    target_client_id: clientId,
    images,
    image_count: images.length,
    rows: 4,
    cols: 4,
    mix: false,
    stage_width: 1280,
    stage_height: 720,
    seed: 99,
    ...config,
  };
  const resp = await request.put("/api/collage-config", {
    data: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
  expect(resp.ok()).toBeTruthy();
  createdFiles.add(path.join(METADATA_DIR, `collage_config__${clientId}.json`));
  return resp.json();
}

async function postSubtitle(
  request: APIRequestContext,
  clientId: string,
  text: string,
  durationSeconds: number,
) {
  const resp = await request.post(`/api/subtitles?target_client_id=${clientId}`, {
    data: JSON.stringify({ text, language: "zh-TW", duration_seconds: durationSeconds }),
    headers: { "Content-Type": "application/json" },
  });
  expect(resp.ok()).toBeTruthy();
}

async function postCaption(
  request: APIRequestContext,
  clientId: string,
  text: string,
  durationSeconds: number,
) {
  const resp = await request.post(`/api/captions?target_client_id=${clientId}`, {
    data: JSON.stringify({ text, language: "zh-TW", duration_seconds: durationSeconds }),
    headers: { "Content-Type": "application/json" },
  });
  expect(resp.ok()).toBeTruthy();
}

async function expectPiecesCount(page: Page, expected: number) {
  const pieces = page.locator(".collage-piece");
  await expect(pieces.first()).toBeVisible({ timeout: 40_000 });
  await expect(async () => {
    const count = await pieces.count();
    expect(count).toBe(expected);
  }).toPass({ timeout: 40_000 });
}

test.describe("即時顯示 e2e", () => {
  test.afterAll(async () => {
    await cleanupArtifacts();
  });

  test("iframe_mode 依設定渲染並可即時更新與還原 snapshot", async ({ page, request }) => {
    const clientId = makeClientId("iframe");
    const initialPanels = [
      { id: "left", url: "/?static_mode=true&img=offspring_20250923_161704_451.png", ratio: 1, label: "left" },
      { id: "right", url: `/?slide_mode=true&img=${IMAGE_A}`, ratio: 1, label: "right" },
    ];
    const updatedPanels = [
      { id: "wide", url: "/?video_mode=true&video=Drive_in_stormy.mp4", ratio: 1.2, label: "wide" },
      { id: "collage", url: `/?collage_mode=true&client=${clientId}`, ratio: 1, label: "collage" },
      { id: "incubator", url: `/?incubator=true&img=${IMAGE_B}`, ratio: 1, label: "incubator" },
    ];

    const created = await setIframeConfig(request, clientId, initialPanels, { columns: 2, layout: "grid", gap: 12 });
    expect(Array.isArray(created?.panels)).toBeTruthy();

    await page.goto(`/?iframe_mode=true&client=${clientId}`);
    const frames = page.locator("iframe");
    await expect(frames).toHaveCount(initialPanels.length, { timeout: 30_000 });
    for (let i = 0; i < initialPanels.length; i += 1) {
      const src = await frames.nth(i).evaluate((node) => (node as HTMLIFrameElement).src);
      expect(src).toBe(absoluteSrc(created.panels[i].src));
      await expectFrameHasContent(page.frameLocator("iframe").nth(i));
    }

    const snapshotName = await snapshotIframeConfig(request, clientId, "e2e-iframes");

    const updated = await setIframeConfig(request, clientId, updatedPanels, { columns: 3, layout: "horizontal", gap: 6 });
    await expect(frames).toHaveCount(updatedPanels.length, { timeout: 20_000 });
    await expect(async () => {
      const urls = await Promise.all(
        Array.from({ length: updatedPanels.length }).map((_, idx) => frames.nth(idx).evaluate((node) => (node as HTMLIFrameElement).src)),
      );
      expect(urls).toEqual(updated.panels.map((panel: { src: string }) => absoluteSrc(panel.src)));
    }).toPass({ timeout: 20_000 });

    const restored = await restoreIframeConfig(request, clientId, snapshotName);
    await expect(frames).toHaveCount(initialPanels.length, { timeout: 20_000 });
    await expect(async () => {
      const urls = await Promise.all(
        Array.from({ length: initialPanels.length }).map((_, idx) => frames.nth(idx).evaluate((node) => (node as HTMLIFrameElement).src)),
      );
      expect(urls).toEqual(restored.panels.map((panel: { src: string }) => absoluteSrc(panel.src)));
    }).toPass({ timeout: 20_000 });
  });

  test("collage_mode 渲染碎片並接受 rows/cols/mix 變更", async ({ page, request }) => {
    const clientId = makeClientId("collage");
    await setCollageConfig(request, clientId, {
      rows: 4,
      cols: 3,
      images: [IMAGE_A],
      mix: false,
      seed: 77,
      stage_width: 1024,
      stage_height: 768,
    });

    await page.goto(`/?collage_mode=true&client=${clientId}`);
    await expect(page.getByText("沒有圖像可顯示")).toBeHidden({ timeout: 10_000 });
    await expectPiecesCount(page, 12);
    await expect(page.locator(".collage-piece--mixed")).toHaveCount(0);

    await setCollageConfig(request, clientId, {
      rows: 5,
      cols: 4,
      images: [IMAGE_A, IMAGE_B],
      mix: true,
      seed: 1234,
      stage_width: 1440,
      stage_height: 900,
    });

    await expectPiecesCount(page, 40);
    await expect(page.locator(".collage-piece--mixed").first()).toBeVisible({ timeout: 40_000 });
  });

  test("subtitle/caption 透過 WebSocket 更新並能清除", async ({ page, request }) => {
    const clientId = makeClientId("overlay");
    const subtitleText = "字幕即時測試";
    const captionText = "標題即時測試";

    await page.goto(`/?caption_mode=true&client=${clientId}`);

    await postSubtitle(request, clientId, subtitleText, 3);
    const subtitleLocator = page.locator(".subtitle-text");
    await expect(subtitleLocator).toHaveText(subtitleText, { timeout: 10_000 });
    await expect(subtitleLocator).toBeHidden({ timeout: 10_000 });

    await postCaption(request, clientId, captionText, 6);
    const captionLocator = page.locator(".caption-mode-text");
    await expect(captionLocator).toHaveText(captionText, { timeout: 10_000 });

    const clearCaption = await request.delete(`/api/captions?target_client_id=${clientId}`);
    expect(clearCaption.ok()).toBeTruthy();
    await expect(captionLocator).toBeHidden({ timeout: 10_000 });

    const clearSubtitle = await request.delete(`/api/subtitles?target_client_id=${clientId}`);
    expect(clearSubtitle.ok()).toBeTruthy();
  });

  test("多 client 的 collage/overlay 互不影響", async ({ browser, request }) => {
    const clientA = makeClientId("deskA");
    const clientB = makeClientId("deskB");

    await setCollageConfig(request, clientA, { rows: 3, cols: 3, images: [IMAGE_A], mix: false, seed: 50 });
    await setCollageConfig(request, clientB, { rows: 2, cols: 2, images: [IMAGE_B], mix: false, seed: 60 });

    const pageA = await browser.newPage();
    const pageB = await browser.newPage();

    await pageA.goto(`/?collage_mode=true&client=${clientA}`);
    await pageB.goto(`/?collage_mode=true&client=${clientB}`);

    await expectPiecesCount(pageA, 9);
    await expectPiecesCount(pageB, 4);

    await setCollageConfig(request, clientA, {
      rows: 4,
      cols: 3,
      images: [IMAGE_A, IMAGE_C],
      mix: true,
      seed: 42,
      stage_width: 1280,
      stage_height: 800,
    });

    await expectPiecesCount(pageA, 24);
    await expect(pageA.locator(".collage-piece--mixed").first()).toBeVisible({ timeout: 40_000 });
    await expect(pageB.locator(".collage-piece--mixed")).toHaveCount(0);
    await expectPiecesCount(pageB, 4);

    await postSubtitle(request, clientA, "A 專屬字幕", 3);
    await expect(pageA.locator(".subtitle-text")).toHaveText("A 專屬字幕", { timeout: 10_000 });
    await expect(pageB.locator(".subtitle-text")).toBeHidden({ timeout: 5_000 });

    await pageA.close();
    await pageB.close();
  });
});
