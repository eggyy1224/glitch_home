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
    vi.useFakeTimers();
    const clearTimeoutMock = vi.fn<Parameters<typeof clearTimeout>, ReturnType<typeof clearTimeout>>();
    const setTimeoutMock = vi.fn<Parameters<typeof setTimeout>, ReturnType<typeof setTimeout>>((cb, delay) => {
      return setTimeout(cb, delay);
    });
    const onNavigate = vi.fn();
    const clock = { setTimeout: setTimeoutMock, clearTimeout: clearTimeoutMock };
    const { result } = renderHook(() => useKinshipNavigation({ clock, getSearch: () => "" }));

    let cancel: (() => void) | undefined;
    act(() => {
      cancel = result.current.scheduleNavigation("next.png", onNavigate, 5);
    });

    expect(setTimeoutMock).toHaveBeenCalled();
    expect(setTimeoutMock).toHaveBeenCalledWith(expect.any(Function), 5000);
    const [callback] = setTimeoutMock.mock.calls[0] ?? [];
    if (typeof callback === "function") {
      callback();
    }
    expect(onNavigate).toHaveBeenCalledWith("next.png");

    cancel?.();
    const timerId = setTimeoutMock.mock.results[0]?.value;
    expect(clearTimeoutMock).toHaveBeenCalledWith(timerId);
    vi.useRealTimers();
  });
});
