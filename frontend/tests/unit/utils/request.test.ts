import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { request, buildImageUrl } from "../../../src/utils/request";
import type { Mock } from "vitest";

const originalFetch = global.fetch;

const createResponse = ({
  ok = true,
  status = 200,
  jsonData = {},
  textData = "",
  url = "http://localhost/api/test",
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

describe("request utility", () => {
  let fetchMock: Mock<[input: RequestInfo | URL, init?: RequestInit | undefined], Promise<Response>>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("會自動補上 baseUrl 並回傳解析後的 JSON", async () => {
    const payload = { ok: true };
    fetchMock.mockResolvedValueOnce(createResponse({ jsonData: payload }));

    const result = await request("/api/items", { baseUrl: "http://example.com" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://example.com/api/items",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result).toEqual(payload);
  });

  it("失敗時會組合狀態碼與錯誤訊息", async () => {
    fetchMock.mockResolvedValueOnce(
      createResponse({ ok: false, status: 404, textData: "not found", contentType: "text/plain" }),
    );

    await expect(request("/api/missing"))
      .rejects.toThrow("API 404: not found");
  });

  it("會傳遞 signal 並自動轉換 JSON body", async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(createResponse({ jsonData: { ok: true } }));

    await request("/api/send", { method: "POST", body: { hello: "world" }, signal: controller.signal });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/send",
      expect.objectContaining({
        method: "POST",
        signal: controller.signal,
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    const lastCall = fetchMock.mock.lastCall;
    expect(lastCall).toBeTruthy();
    const body = lastCall?.[1]?.body;
    expect(body).toBe(JSON.stringify({ hello: "world" }));
  });

  it("buildImageUrl 會確保基底與檔名正確組合", () => {
    expect(buildImageUrl("file.png", "http://host/base"))
      .toBe("http://host/base/file.png");
    expect(buildImageUrl("nested/name.jpg", "/root"))
      .toBe("/root/nested/name.jpg");
    expect(buildImageUrl(null, "/root")).toBeNull();
  });
});
