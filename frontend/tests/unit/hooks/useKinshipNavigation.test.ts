import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKinshipNavigation } from "../../../src/hooks/useKinshipNavigation";

const createStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) || null,
    setItem: (key: string, value: string) => store.set(key, value),
    clear: () => store.clear(),
  };
};

describe("useKinshipNavigation", () => {
  it("更新網址參數時會保留現有參數並覆蓋 img", () => {
    const getSearch = vi.fn(() => "?foo=bar&img=old");
    const replaceUrl = vi.fn();
    const { result } = renderHook(() =>
      useKinshipNavigation({ getSearch, replaceUrl, clock: { setTimeout, clearTimeout } }),
    );

    act(() => {
      result.current.updateUrlParams("next.png");
    });

    expect(replaceUrl).toHaveBeenCalledWith("?foo=bar&img=next.png");
  });

  it("會從查詢參數取得自動播放設定並套用步進下限", () => {
    const getSearch = vi.fn(() => "?continuous=true&autoplay=1&step=1");
    const { result } = renderHook(() => useKinshipNavigation({ getSearch, clock: { setTimeout, clearTimeout } }));

    const config = result.current.getAutoplayConfig();
    expect(config).toEqual({ continuous: true, autoplay: true, stepSec: 2 });
  });

  it("使用注入的 storage 讀寫造訪紀錄", () => {
    const storage = createStorage();
    const { result } = renderHook(() => useKinshipNavigation({ storage, clock: { setTimeout, clearTimeout } }));

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
    const setTimeout = vi.fn((cb: () => void, delay: number) => {
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

    expect(setTimeout).toHaveBeenCalled();
    const firstCall = setTimeout.mock.calls[0] || [];
    const [callback, delay] = firstCall;
    expect(typeof callback).toBe("function");
    expect(delay).toBe(5000);
    scheduledCallback();
    expect(onNavigate).toHaveBeenCalledWith("next.png");

    cancel();
    expect(clearTimeout).toHaveBeenCalledWith(5000);
  });
});
