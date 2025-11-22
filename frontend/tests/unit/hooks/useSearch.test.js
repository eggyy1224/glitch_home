import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import useSearch from "../../../src/hooks/useSearch.js";
import {
  createImageSearchRequest,
  createImageUploadRequest,
  createTextSearchRequest,
} from "../../../src/api.js";

vi.mock("../../../src/api.js", () => ({
  __esModule: true,
  createImageSearchRequest: vi.fn(),
  createImageUploadRequest: vi.fn(),
  createTextSearchRequest: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  const resolvedRequest = (value) => ({ controller: new AbortController(), promise: Promise.resolve(value) });
  createTextSearchRequest.mockReturnValue(resolvedRequest({ results: [] }));
  createImageUploadRequest.mockReturnValue(resolvedRequest({ searchPath: "", fallbackPath: "" }));
  createImageSearchRequest.mockReturnValue(resolvedRequest({ results: [] }));
});

describe("useSearch", () => {
  it("空字串搜尋會提示錯誤且不呼叫 API", async () => {
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.searchByText();
    });

    expect(result.current.error).toBe("請輸入搜尋詞");
    expect(createTextSearchRequest).not.toHaveBeenCalled();
  });

  it("文字搜尋成功時更新結果並清除錯誤", async () => {
    const payload = { results: [{ id: "img-1", distance: 0.12 }] };
    createTextSearchRequest.mockReturnValue({ controller: new AbortController(), promise: Promise.resolve(payload) });

    const { result } = renderHook(() => useSearch({ limit: 5 }));

    act(() => {
      result.current.setTextQuery("night horse");
    });

    await act(async () => {
      await result.current.searchByText();
    });

    expect(createTextSearchRequest).toHaveBeenCalledWith("night horse", 5);
    await waitFor(() => {
      expect(result.current.results).toEqual(payload.results);
      expect(result.current.error).toBeNull();
      expect(result.current.searching).toBe(false);
    });
  });

  it("未選檔案進行圖片搜尋會回傳錯誤訊息", async () => {
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.searchByImage();
    });

    expect(result.current.error).toBe("請先選擇圖片");
    expect(createImageUploadRequest).not.toHaveBeenCalled();
  });

  it("從結果觸發搜尋會呼叫圖片搜尋並處理空結果訊息", async () => {
    createImageSearchRequest.mockReturnValue({ controller: new AbortController(), promise: Promise.resolve({ results: [] }) });
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.searchFromResult("offspring.png");
    });

    expect(createImageSearchRequest).toHaveBeenCalledWith("backend/offspring_images/offspring.png", 15);
    await waitFor(() => {
      expect(result.current.error).toBe("搜尋完成，但沒有找到相似的圖像");
      expect(result.current.searching).toBe(false);
    });
  });

  it("取消文字搜尋時不會殘留 loading 或錯誤", async () => {
    const abortError = new Error("aborted");
    abortError.name = "AbortError";
    createTextSearchRequest.mockReturnValue({ controller: new AbortController(), promise: Promise.reject(abortError) });

    const { result } = renderHook(() => useSearch());

    act(() => {
      result.current.setTextQuery("fast");
    });

    await act(async () => {
      await result.current.searchByText();
    });

    await waitFor(() => {
      expect(result.current.searching).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
