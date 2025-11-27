import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../../src/App.jsx";
import { DisplayModes } from "../../src/hooks/useDisplayMode.js";

const {
  mockUseModeParams,
  mockUseCameraPresets,
  mockUseKinshipData,
  mockUseSubtitleCaption,
  mockUseScreenshotManager,
  mockUseIframeConfig,
  mockUseCollageConfig,
  mockUseSoundQueue,
  mockUseRemoteTimelineControl,
  mockUseControlSocketHandlers,
  mockUseControlSocket,
  mockCreateModeRenderMap,
  ModeLayoutMock,
  ControlPanelMock,
  ScreenshotMessageMock,
  IframeTimelineControlsMock,
  KINSHIP_DATA_EXCLUDED,
} = vi.hoisted(() => {
  const makeDiv = (testId) =>
    vi.fn(() => (
      <div data-testid={testId} />
    ));
  const modeLayout = vi.fn((props) => (
    <div data-testid="mode-layout">
      {props.beforeContent}
      {props.afterContent}
    </div>
  ));
  return {
    mockUseModeParams: vi.fn(),
    mockUseCameraPresets: vi.fn(),
    mockUseKinshipData: vi.fn(),
    mockUseSubtitleCaption: vi.fn(),
    mockUseScreenshotManager: vi.fn(),
    mockUseIframeConfig: vi.fn(),
    mockUseCollageConfig: vi.fn(),
    mockUseSoundQueue: vi.fn(),
    mockUseRemoteTimelineControl: vi.fn(),
    mockUseControlSocketHandlers: vi.fn(),
    mockUseControlSocket: vi.fn(),
    mockCreateModeRenderMap: vi.fn(),
    ModeLayoutMock: modeLayout,
    ControlPanelMock: makeDiv("control-panel"),
    ScreenshotMessageMock: makeDiv("screenshot-message"),
    IframeTimelineControlsMock: makeDiv("iframe-controls"),
    KINSHIP_DATA_EXCLUDED: new Set(["organic", "slide", "iframe", "static", "video", "admin"]),
  };
});

vi.mock("../../src/hooks/useModeParams.js", () => ({
  useModeParams: mockUseModeParams,
  KINSHIP_DATA_EXCLUDED,
}));

vi.mock("../../src/hooks/useCameraPresets.js", () => ({
  useCameraPresets: mockUseCameraPresets,
}));

vi.mock("../../src/hooks/useKinshipData.js", () => ({
  useKinshipData: mockUseKinshipData,
}));

vi.mock("../../src/hooks/useSubtitleCaption.js", () => ({
  useSubtitleCaption: mockUseSubtitleCaption,
}));

vi.mock("../../src/hooks/useScreenshotManager.js", () => ({
  useScreenshotManager: mockUseScreenshotManager,
}));

vi.mock("../../src/hooks/useIframeConfig.js", () => ({
  useIframeConfig: mockUseIframeConfig,
}));

vi.mock("../../src/hooks/useCollageConfig.js", () => ({
  useCollageConfig: mockUseCollageConfig,
}));

vi.mock("../../src/hooks/useSoundQueue.js", () => ({
  useSoundQueue: mockUseSoundQueue,
}));

vi.mock("../../src/hooks/useRemoteTimelineControl.js", () => ({
  useRemoteTimelineControl: mockUseRemoteTimelineControl,
}));

vi.mock("../../src/hooks/useControlSocketHandlers.js", () => ({
  useControlSocketHandlers: mockUseControlSocketHandlers,
}));

vi.mock("../../src/hooks/useControlSocket.js", () => ({
  useControlSocket: mockUseControlSocket,
}));

vi.mock("../../src/components/ModeLayout.jsx", () => ({
  __esModule: true,
  default: ModeLayoutMock,
}));

vi.mock("../../src/components/ControlPanel.jsx", () => ({
  __esModule: true,
  default: ControlPanelMock,
}));

vi.mock("../../src/components/ScreenshotMessage.jsx", () => ({
  __esModule: true,
  default: ScreenshotMessageMock,
}));

vi.mock("../../src/components/IframeTimelineControls.jsx", () => ({
  __esModule: true,
  default: IframeTimelineControlsMock,
}));

vi.mock("../../src/modes/createModeRenderMap.js", () => ({
  __esModule: true,
  createModeRenderMap: mockCreateModeRenderMap,
}));

const noop = () => {};
let playSpy;
let pauseSpy;

beforeAll(() => {
  const proto = window.HTMLMediaElement?.prototype;
  if (proto) {
    playSpy = vi.spyOn(proto, "play").mockImplementation(() => Promise.resolve());
    pauseSpy = vi.spyOn(proto, "pause").mockImplementation(() => {});
  }
});

afterAll(() => {
  playSpy?.mockRestore();
  pauseSpy?.mockRestore();
});

const baseModeParams = {
  initialParams: new URLSearchParams(),
  initialImg: null,
  activeMode: DisplayModes.KINSHIP,
  incubatorMode: false,
  phylogenyMode: false,
  soundPlayerEnabled: true,
  slideIntervalMs: 3000,
  clientId: "client-1",
  iframeTimelineId: null,
  shouldLoadKinshipData: true,
};

const baseKinship = {
  imgId: null,
  data: null,
  err: null,
  clusters: [],
  navigateToImage: vi.fn(),
};

const baseCameraPresets = {
  cameraInfo: null,
  cameraPresets: [],
  selectedPresetName: "",
  pendingPreset: null,
  presetMessage: null,
  setSelectedPresetName: vi.fn(),
  handleCameraUpdate: vi.fn(),
  handleSavePreset: vi.fn(),
  handleApplyPreset: vi.fn(),
  handleDeletePreset: vi.fn(),
};

const baseSubtitle = {
  subtitle: null,
  caption: null,
  applySubtitle: vi.fn(),
  applyCaption: vi.fn(),
};

const baseScreenshotManager = {
  screenshotMessage: "ready",
  handleCaptureReady: vi.fn(),
  enqueueScreenshotRequest: vi.fn(),
  markRequestDone: vi.fn(),
};

const baseIframeConfig = {
  activeConfig: {},
  controlsEnabled: true,
  handleLocalApply: vi.fn(),
  applyRemoteConfig: vi.fn(),
  releaseRemoteConfig: vi.fn(),
};

const baseCollageConfig = {
  remoteConfig: null,
  remoteSource: null,
  controlsEnabled: true,
  applyRemoteConfig: vi.fn(),
};

const baseSoundQueue = {
  soundPlayRequest: { filename: "tone.wav" },
  handleSoundPlayMessage: vi.fn(),
  handleSoundHandled: vi.fn(),
};

const baseTimeline = {
  effectiveTimelineId: null,
  timeline: null,
  currentStep: null,
  currentStepIndex: 0,
  timelineStatus: "idle",
  timelineIsPlaying: false,
  timelineLoading: false,
  timelineError: null,
  timelineActionError: null,
  playTimeline: vi.fn(),
  pauseTimeline: vi.fn(),
  nextTimelineStep: vi.fn(),
  previousTimelineStep: vi.fn(),
  reloadTimeline: vi.fn(),
  handleStopTimeline: vi.fn(),
  handleTimelineControlMessage: vi.fn(),
};

const baseHandlerMap = {
  handleScreenshotLifecycle: vi.fn(),
  handleSubtitleMessage: vi.fn(),
  handleCaptionMessage: vi.fn(),
  handleIframeConfigMessage: vi.fn(),
  handleCollageConfigMessage: vi.fn(),
  handleUnlockAudioMessage: vi.fn(),
  handleRemoteClickMessage: vi.fn(),
  handleVideoControlMessage: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseModeParams.mockReturnValue({ ...baseModeParams });
  mockUseCameraPresets.mockReturnValue({ ...baseCameraPresets });
  mockUseKinshipData.mockReturnValue({ ...baseKinship });
  mockUseSubtitleCaption.mockReturnValue({ ...baseSubtitle });
  mockUseScreenshotManager.mockReturnValue({ ...baseScreenshotManager });
  mockUseIframeConfig.mockReturnValue({ ...baseIframeConfig });
  mockUseCollageConfig.mockReturnValue({ ...baseCollageConfig });
  mockUseSoundQueue.mockReturnValue({ ...baseSoundQueue });
  mockUseRemoteTimelineControl.mockReturnValue({ ...baseTimeline });
  mockUseControlSocketHandlers.mockReturnValue({ ...baseHandlerMap });
  mockUseControlSocket.mockImplementation(noop);
  mockCreateModeRenderMap.mockImplementation(() => ({
    [DisplayModes.KINSHIP]: {
      component: () => <div data-testid="default-mode" />,
      componentProps: {},
      withCaptureReady: true,
      beforeContent: null,
      afterContent: null,
    },
  }));
});

describe("App", () => {
  it("在親緣模式缺少 img 時顯示提示", () => {
    mockUseKinshipData.mockReturnValue({
      ...baseKinship,
      imgId: null,
    });

    render(<App />);

    expect(screen.getByText("請在網址加上 ?img=檔名")).toBeInTheDocument();
    expect(ModeLayoutMock).toHaveBeenCalledTimes(1);
    expect(ScreenshotMessageMock).not.toHaveBeenCalled();
  });

  it("在親緣模式載入失敗時顯示錯誤訊息", () => {
    mockUseKinshipData.mockReturnValue({
      ...baseKinship,
      imgId: "image-1",
      err: "boom",
    });

    render(<App />);

    expect(screen.getByText("載入失敗：boom")).toBeInTheDocument();
    expect(ModeLayoutMock).toHaveBeenCalledTimes(1);
  });

  it("渲染非親緣模式時會把資料與 overlay 傳給 ModeLayout", () => {
    const data = {
      original_image: "main.png",
      related_images: ["a", "b"],
      parents: ["p"],
      children: [],
      siblings: ["s1", "s2"],
      ancestors: ["anc"],
    };

    mockUseModeParams.mockReturnValue({
      ...baseModeParams,
      activeMode: DisplayModes.IFRAME,
      soundPlayerEnabled: false,
      iframeTimelineId: "timeline-42",
    });

    mockUseKinshipData.mockReturnValue({
      ...baseKinship,
      imgId: "main.png",
      data,
      err: null,
    });

    mockUseRemoteTimelineControl.mockReturnValue({
      ...baseTimeline,
      effectiveTimelineId: "timeline-42",
    });

    const handlerMap = { ...baseHandlerMap };
    mockUseControlSocketHandlers.mockReturnValue(handlerMap);

    const createArgs = {};
    mockCreateModeRenderMap.mockImplementation((args) => {
      createArgs.current = args;
      return {
        [DisplayModes.IFRAME]: {
          component: () => <div data-testid="iframe-mode" />,
          componentProps: { hasOverlay: Boolean(args.iframeTimelineOverlay) },
          withCaptureReady: false,
          beforeContent: <span>before</span>,
          afterContent: <span>after</span>,
        },
      };
    });

    render(<App />);

    expect(createArgs.current).toBeDefined();
    expect(createArgs.current.iframeTimelineOverlay).not.toBeNull();
    expect(createArgs.current.collageRemoteConfig).toBeNull();
    expect(createArgs.current.topbarContent.props).toEqual(
      expect.objectContaining({
        relatedCount: 2,
        parentsCount: 1,
        siblingsCount: 2,
        ancestorsCount: 1,
        originalImage: "main.png",
      }),
    );
    expect(createArgs.current.screenshotContent.props).toEqual(
      expect.objectContaining({ message: "ready" }),
    );

    expect(ModeLayoutMock).toHaveBeenCalledWith(
      expect.objectContaining({
        componentProps: expect.objectContaining({ hasOverlay: true }),
        soundPlayRequest: null,
      }),
      expect.anything(),
    );

    expect(mockUseControlSocket).toHaveBeenCalledWith(
      expect.objectContaining({
        onSoundPlay: baseSoundQueue.handleSoundPlayMessage,
        onTimelineControl: baseTimeline.handleTimelineControlMessage,
      }),
    );
  });

  it("沒有對應 mode render 時回傳 null", () => {
    mockUseModeParams.mockReturnValue({
      ...baseModeParams,
      activeMode: DisplayModes.SEARCH,
    });
    mockUseKinshipData.mockReturnValue({
      ...baseKinship,
      imgId: "img-1",
      err: null,
    });
    mockCreateModeRenderMap.mockReturnValue({});

    const { container } = render(<App />);
    expect(container.firstChild).toBeNull();
  });
});
