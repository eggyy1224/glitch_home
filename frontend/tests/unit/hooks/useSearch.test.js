import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import useSearch from "../../../src/hooks/useSearch.js";
import { searchImagesByImage, searchImagesByText } from "../../../src/api.js";

vi.mock("../../../src/api.js", () => ({
  __esModule: true,
  searchImagesByImage: vi.fn(),
  searchImagesByText: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useSearch", () => {
  it("空字串搜尋會提示錯誤且不呼叫 API", async () => {
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.searchByText();
    });

    expect(result.current.error).toBe("請輸入搜尋詞");
    expect(searchImagesByText).not.toHaveBeenCalled();
  });

  it("文字搜尋成功時更新結果並清除錯誤", async () => {
    const payload = { results: [{ id: "img-1", distance: 0.12 }] };
    searchImagesByText.mockResolvedValue(payload);

    const { result } = renderHook(() => useSearch({ limit: 5 }));

    act(() => {
      result.current.setTextQuery("night horse");
    });

    await act(async () => {
      await result.current.searchByText();
    });

    expect(searchImagesByText).toHaveBeenCalledWith("night horse", 5);
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
    expect(searchImagesByImage).not.toHaveBeenCalled();
  });

  it("從結果觸發搜尋會呼叫圖片搜尋並處理空結果訊息", async () => {
    searchImagesByImage.mockResolvedValue({ results: [] });
    const { result } = renderHook(() => useSearch());

    await act(async () => {
      await result.current.searchFromResult("offspring.png");
    });

    expect(searchImagesByImage).toHaveBeenCalledWith("backend/offspring_images/offspring.png", 15);
    await waitFor(() => {
      expect(result.current.error).toBe("搜尋完成，但沒有找到相似的圖像");
      expect(result.current.searching).toBe(false);
    });
  });
});
