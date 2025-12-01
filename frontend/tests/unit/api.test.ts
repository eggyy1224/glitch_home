import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchKinship,
  fetchIframeTimeline,
  fetchSoundFiles,
  queueSoundPlay,
  generateMixTwo,
} from "../../src/api";
import type { Mock } from "vitest";

const originalFetch = global.fetch;
const createResponse = ({
  ok = true,
  status = 200,
  jsonData = {},
  textData = "ok",
  url = "http://localhost/test",
  contentType = "application/json",
} = {}) =>
  ({
    ok,
    status,
    url,
    headers: { get: vi.fn().mockReturnValue(contentType) },
    json: vi.fn().mockResolvedValue(jsonData),
    text: vi.fn().mockResolvedValue(textData),
  }) as unknown as Response;

describe("api.js fetch helpers", () => {
  let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit | undefined], Promise<Response>>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetchKinship 成功時會回傳 JSON，失敗時丟出錯誤", async () => {
    const payload = { data: [1, 2] };
    fetchMock.mockResolvedValueOnce(createResponse({ jsonData: payload }));
    const result = await fetchKinship("kinship image", 2);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/kinship?img=kinship%20image&depth=2",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toEqual(payload);

    fetchMock.mockResolvedValueOnce(createResponse({ ok: false, status: 500 }));
    await expect(fetchKinship("broken")).rejects.toThrow("API 500");
  });

  it("fetchIframeTimeline 需要 timelineId 並回傳詳細錯誤訊息", async () => {
    // @ts-expect-error  intentionally missing timelineId to assert error
    await expect(fetchIframeTimeline()).rejects.toThrow("timelineId is required");

    const timelinePayload = { steps: [] };
    fetchMock.mockResolvedValueOnce(createResponse({ jsonData: timelinePayload }));
    const result = await fetchIframeTimeline("timeline-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/iframe-timelines/timeline-1",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toEqual(timelinePayload);

    fetchMock.mockResolvedValueOnce(
      createResponse({ ok: false, status: 404, textData: "missing timeline", contentType: "text/plain" }),
    );
    await expect(fetchIframeTimeline("ghost")).rejects.toThrow("API 404: missing timeline");
  });

  it("fetchSoundFiles 會將 URL 重新編碼", async () => {
    const filePayload = {
      files: [
        { filename: "sound.wav", url: "/sounds/測試 影片.wav" },
        { filename: "raw.wav" },
      ],
    };
    fetchMock.mockResolvedValueOnce(
      createResponse({ jsonData: filePayload, url: "http://localhost/api/sound-files" }),
    );
    const result = await fetchSoundFiles();
    expect(result.files[0].url).toContain("http://localhost");
    expect(result.files[0].url).not.toContain(" ");
    expect(result.files[1]).toEqual(filePayload.files[1]);
  });

  it("queueSoundPlay 會將 target_client_id 包入 payload 並處理錯誤", async () => {
    fetchMock.mockResolvedValueOnce(createResponse({ jsonData: { ok: true } }));
    await queueSoundPlay("effect.wav", "client-z");
    expect(fetchMock).toHaveBeenCalledWith("/api/sound-play", expect.objectContaining({
      method: "POST",
    }));
    const lastCall = fetchMock.mock.lastCall;
    expect(lastCall).toBeDefined();
    const body = JSON.parse((lastCall?.[1]?.body as string) ?? "{}");
    expect(body).toMatchObject({ filename: "effect.wav", target_client_id: "client-z" });

    fetchMock.mockResolvedValueOnce(
      createResponse({ ok: false, status: 400, textData: "bad", contentType: "text/plain" }),
    );
    await expect(queueSoundPlay("broken")).rejects.toThrow("API 400: bad");
  });

  it("generateMixTwo 會傳回 imageUrl 並處理錯誤訊息", async () => {
    fetchMock.mockResolvedValueOnce(
      createResponse({
        jsonData: { output_image_path: "backend/offspring_images/offspring_123.png" },
      }),
    );
    const result = await generateMixTwo({ count: 1 });
    expect(fetchMock).toHaveBeenCalledWith("/api/generate/mix-two", expect.objectContaining({
      method: "POST",
    }));
    expect(result.imageUrl).toBe("/generated_images/offspring_123.png");

    fetchMock.mockResolvedValueOnce(
      createResponse({ ok: false, status: 500, textData: "boom", contentType: "text/plain" }),
    );
    await expect(generateMixTwo({})).rejects.toThrow("API 500: boom");
  });
});
