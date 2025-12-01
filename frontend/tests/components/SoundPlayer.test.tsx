import { describe, it, expect, vi, beforeEach, afterEach, type SpyInstance, type Mock } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SoundPlayer from "../../src/SoundPlayer";
import type * as api from "../../src/api";

type ApiMocks = {
  fetchSoundFiles: Mock;
};

const apiMocksRef = vi.hoisted(() => ({ current: null as ApiMocks | null }));
let apiMocks: ApiMocks;

const getApiMocks = () => {
  const mocks = apiMocksRef.current;
  if (!mocks) {
    throw new Error("apiMocks not initialized");
  }
  return mocks;
};

vi.mock("../../src/api", async () => {
  const { createMockApi } = await import("../testUtils");
  const { mocks, factory } = createMockApi<typeof api, "fetchSoundFiles">(["fetchSoundFiles"]);
  apiMocksRef.current = mocks;
  return { __esModule: true, ...factory() };
});

const mockFiles = [
  {
    filename: "test1.mp3",
    url: "https://example.com/sounds/test1.mp3",
    size: 2048,
    modified_at: "2024-01-01T02:00:00.000Z",
  },
  {
    filename: "test2.mp3",
    url: "https://example.com/sounds/test2.mp3",
    size: 1024,
    modified_at: "2024-01-02T02:00:00.000Z",
  },
];

describe("SoundPlayer", () => {
  let playSpy: SpyInstance | undefined;
  let pauseSpy: SpyInstance | undefined;

  beforeEach(() => {
    apiMocks = getApiMocks();
    apiMocks.fetchSoundFiles.mockReset();
    apiMocks.fetchSoundFiles.mockResolvedValue({ files: mockFiles });
    playSpy = vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    playSpy?.mockRestore();
    pauseSpy?.mockRestore();
  });

  it("載入並展示音效清單與中繼資料", async () => {
    const localeSpy = vi.spyOn(Date.prototype, "toLocaleString").mockReturnValue("2024/01/01 10:00");
    render(<SoundPlayer />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("test1.mp3");
    });

    expect(screen.getByText("2.0KB · 2024/01/01 10:00")).toBeInTheDocument();
    localeSpy.mockRestore();
  });

  it("點擊重新整理會重新載入音效清單", async () => {
    const user = userEvent.setup();
    render(<SoundPlayer />);

    const reloadButton = await screen.findByRole("button", { name: "重新整理" });
    await waitFor(() => {
      expect(reloadButton).not.toBeDisabled();
    });
    await act(async () => {
      await user.click(reloadButton);
    });

    await waitFor(() => {
      expect(apiMocks.fetchSoundFiles).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(reloadButton).not.toBeDisabled();
    });
  });

  it("當 API 回傳空清單時顯示提示錯誤", async () => {
    apiMocks.fetchSoundFiles.mockImplementation(() => Promise.resolve({ files: [] }));
    render(<SoundPlayer />);

    await waitFor(() => {
      expect(screen.getByText("目前沒有音效檔可播放。")).toBeInTheDocument();
    });
  });

  it("API 拋錯時顯示錯誤訊息", async () => {
    apiMocks.fetchSoundFiles.mockImplementation(() => Promise.reject(new Error("無法取得音效")));
    render(<SoundPlayer />);

    await waitFor(() => {
      expect(screen.getByText("無法取得音效")).toBeInTheDocument();
    });
  });

  it("收到播放請求時會自動切換檔案並嘗試播放", async () => {
    const handled = vi.fn();
    render(<SoundPlayer playRequest={{ filename: "test2.mp3" }} onPlayHandled={handled} />);

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("test2.mp3");
    });

    await waitFor(() => {
      expect(playSpy).toHaveBeenCalled();
    });
    expect(handled).toHaveBeenCalledTimes(1);
  });

  it("找不到檔案但帶有 URL 時會新增到清單並播放", async () => {
    apiMocks.fetchSoundFiles.mockImplementation(() => Promise.resolve({ files: [] }));
    render(<SoundPlayer playRequest={{ filename: "ghost.mp3", url: "https://example.com/ghost.mp3" }} />);

    if (!playSpy) {
      throw new Error("playSpy not initialized");
    }

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toHaveValue("ghost.mp3");
    });
    await waitFor(() => {
      expect(playSpy).toHaveBeenCalled();
    });
  });

  it("當自動播放被阻擋時顯示提示訊息", async () => {
    if (!playSpy) {
      throw new Error("playSpy not initialized");
    }
    playSpy.mockImplementation(() => Promise.reject(new Error("blocked")));
    render(<SoundPlayer playRequest={{ filename: "test1.mp3" }} />);

    await waitFor(() => {
      expect(screen.getByText("自動播放被瀏覽器阻擋，請點擊任意處或按下方播放。")).toBeInTheDocument();
    });
  });

  it("audio 元件 onError 會顯示錯誤提示", async () => {
    const { container } = render(<SoundPlayer />);
    const audio = await waitFor(() => {
      const node = container.querySelector("audio");
      if (!node) {
        throw new Error("audio element not ready");
      }
      return node;
    });
    fireEvent.error(audio);

    await waitFor(() => {
      expect(screen.getByText(/音檔載入失敗/)).toBeInTheDocument();
    });
  });
});
