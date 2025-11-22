import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKinshipNavigation } from "../../../src/hooks/useKinshipNavigation.js";

const createStorage = () => {
  const store = new Map();
  return {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, value),
    clear: () => store.clear(),
  };
};

describe("useKinshipNavigation", () => {
  it("更新網址參數時會保留現有參數並覆蓋 img", () => {
    const getSearch = vi.fn(() => "?foo=bar&img=old");
    const replaceUrl = vi.fn();
    const { result } = renderHook(() =>
      useKinshipNavigation({ getSearch, replaceUrl, clock: {} }),
    );

    act(() => {
      result.current.updateUrlParams("next.png");
    });

    expect(replaceUrl).toHaveBeenCalledWith("?foo=bar&img=next.png");
  });

  it("會從查詢參數取得自動播放設定並套用步進下限", () => {
    const getSearch = vi.fn(() => "?continuous=true&autoplay=1&step=1");
    const { result } = renderHook(() => useKinshipNavigation({ getSearch, clock: {} }));

    const config = result.current.getAutoplayConfig();
    expect(config).toEqual({ continuous: true, autoplay: true, stepSec: 2 });
  });

  it("使用注入的 storage 讀寫造訪紀錄", () => {
    const storage = createStorage();
    const { result } = renderHook(() => useKinshipNavigation({ storage, clock: {} }));

    act(() => {
      const visited = result.current.readVisitedImages();
      visited.add("first.png");
      result.current.saveVisitedImages(visited);
    });

    expect(result.current.readVisitedImages()).toEqual(new Set(["first.png"]));
  });

  it("使用注入的 clock 安排導覽並能取消", () => {
    const clearTimeout = vi.fn();
    let scheduledCallback = null;
    const setTimeout = vi.fn((cb, delay) => {
      scheduledCallback = cb;
      return delay;
    });
    const onNavigate = vi.fn();
    const clock = { setTimeout, clearTimeout };
    const { result } = renderHook(() => useKinshipNavigation({ clock, getSearch: () => "" }));

    let cancel;
    act(() => {
      cancel = result.current.scheduleNavigation("next.png", onNavigate, 5);
    });

    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
    scheduledCallback();
    expect(onNavigate).toHaveBeenCalledWith("next.png");

    cancel();
    expect(clearTimeout).toHaveBeenCalledWith(5000);
  });
});
