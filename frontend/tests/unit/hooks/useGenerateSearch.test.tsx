import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import useGenerateSearch from "../../../src/hooks/useGenerateSearch";
import { createImageSearchRequest, createTextSearchRequest } from "../../../src/api";
import type { Mock } from "vitest";

vi.mock("../../../src/api", () => ({
  __esModule: true,
  createImageSearchRequest: vi.fn(),
  createTextSearchRequest: vi.fn(),
}));

const createImageSearchRequestMock = createImageSearchRequest as Mock<
  Parameters<typeof createImageSearchRequest>,
  ReturnType<typeof createImageSearchRequest>
>;
const createTextSearchRequestMock = createTextSearchRequest as Mock<
  Parameters<typeof createTextSearchRequest>,
  ReturnType<typeof createTextSearchRequest>
>;

const resolvedRequest = <T,>(value: T) => ({ controller: new AbortController(), promise: Promise.resolve(value) });

beforeEach(() => {
  vi.clearAllMocks();
  createTextSearchRequestMock.mockReturnValue(resolvedRequest({ results: [] }));
  createImageSearchRequestMock.mockReturnValue(resolvedRequest({ results: [] }));
});

describe("useGenerateSearch", () => {
  it("檔名匹配時會以圖搜圖（去除語系後綴）並切換到搜尋結果", async () => {
    const onError = vi.fn();
    const payload = { results: [{ id: "image-1:en", distance: 0.42 }] };
    createImageSearchRequestMock.mockReturnValue(resolvedRequest(payload));

    const availableImages = [{ filename: "horse.png" }];
    const { result } = renderHook(() => useGenerateSearch({ onError, availableImages }));

    act(() => {
      result.current.setTextQuery("horse");
    });

    await act(async () => {
      await result.current.handleTextSearch();
    });

    await waitFor(() => {
      expect(createImageSearchRequestMock).toHaveBeenCalledWith("horse.png", 50);
      expect(createTextSearchRequestMock).not.toHaveBeenCalled();
      expect(result.current.searchResults).toEqual([
        { filename: "image-1", url: "/generated_images/image-1" },
      ]);
      expect(result.current.displayMode).toBe("search");
      expect(onError).toHaveBeenLastCalledWith(null);
    });
  });

  it("沒有檔名匹配時會退回文字語意搜尋", async () => {
    const onError = vi.fn();
    const payload = { results: [{ id: "image-1:en", distance: 0.42 }] };
    createTextSearchRequestMock.mockReturnValue(resolvedRequest(payload));

    const { result } = renderHook(() => useGenerateSearch({ onError }));

    act(() => {
      result.current.setTextQuery("white horse");
    });

    await act(async () => {
      await result.current.handleTextSearch();
    });

    await waitFor(() => {
      expect(createImageSearchRequestMock).not.toHaveBeenCalled();
      expect(result.current.searchResults).toEqual([{ filename: "image-1", url: "/generated_images/image-1" }]);
      expect(result.current.displayMode).toBe("search");
      expect(onError).toHaveBeenLastCalledWith(null);
    });
  });

  it("沒有結果時會重置顯示模式並回傳訊息", async () => {
    const onError = vi.fn();
    createTextSearchRequestMock.mockReturnValue(resolvedRequest({ results: [] }));

    const { result } = renderHook(() => useGenerateSearch({ onError }));

    act(() => {
      result.current.setTextQuery("moon");
    });

    await act(async () => {
      await result.current.handleTextSearch();
    });

    await waitFor(() => {
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.displayMode).toBe("all");
      expect(onError).toHaveBeenCalledWith("未找到與「moon」相關的圖像");
    });
  });

  it("API 失敗時會回報錯誤訊息並結束搜尋狀態", async () => {
    const onError = vi.fn();
    const error = new Error("server down");
    createTextSearchRequestMock.mockReturnValue({
      controller: new AbortController(),
      promise: Promise.reject(error),
    });

    const { result } = renderHook(() => useGenerateSearch({ onError }));

    act(() => {
      result.current.setTextQuery("fail request");
    });

    await act(async () => {
      await result.current.handleTextSearch();
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith("server down");
      expect(result.current.searching).toBe(false);
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.displayMode).toBe("all");
    });
  });

  it("AbortError 會被忽略且不顯示錯誤訊息", async () => {
    const onError = vi.fn();
    const abortError = new DOMException("Aborted", "AbortError");
    createTextSearchRequestMock.mockReturnValue({
      controller: new AbortController(),
      promise: Promise.reject(abortError),
    });

    const { result } = renderHook(() => useGenerateSearch({ onError }));

    act(() => {
      result.current.setTextQuery("horse");
    });

    await act(async () => {
      onError.mockClear();
      await result.current.handleTextSearch();
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(null);
      expect(result.current.searching).toBe(false);
    });
  });

  it("清除搜尋會重設檔案、結果與錯誤", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useGenerateSearch({ onError }));

    act(() => {
      result.current.setTextQuery("test");
      onError.mockClear();
      result.current.handleSearchClear();
    });

    expect(result.current.textQuery).toBe("");
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.displayMode).toBe("all");
    expect(onError).toHaveBeenCalledWith(null);
  });
});
