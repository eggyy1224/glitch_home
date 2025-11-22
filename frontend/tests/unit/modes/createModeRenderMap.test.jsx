import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  IframeModeMock,
  SlideModeMock,
  OrganicRoomSceneMock,
  SearchModeMock,
  CollageModeMock,
  CaptionModeMock,
  CollageVersionModeMock,
  GenerateModeMock,
  StaticModeMock,
  VideoModeMock,
  KinshipSceneMock,
  AdminPanelMock,
} = vi.hoisted(() => {
  const stub = (name) => vi.fn(() => name);
  return {
    IframeModeMock: stub("IframeMode"),
    SlideModeMock: stub("SlideMode"),
    OrganicRoomSceneMock: stub("OrganicRoomScene"),
    SearchModeMock: stub("SearchMode"),
    CollageModeMock: stub("CollageMode"),
    CaptionModeMock: stub("CaptionMode"),
    CollageVersionModeMock: stub("CollageVersionMode"),
    GenerateModeMock: stub("GenerateMode"),
    StaticModeMock: stub("StaticMode"),
    VideoModeMock: stub("VideoMode"),
    KinshipSceneMock: stub("KinshipScene"),
    AdminPanelMock: stub("AdminPanel"),
  };
});

vi.mock("../../../src/IframeMode.jsx", () => ({ __esModule: true, default: IframeModeMock }));
vi.mock("../../../src/SlideMode.jsx", () => ({ __esModule: true, default: SlideModeMock }));
vi.mock("../../../src/OrganicRoomScene.jsx", () => ({ __esModule: true, default: OrganicRoomSceneMock }));
vi.mock("../../../src/SearchMode.jsx", () => ({ __esModule: true, default: SearchModeMock }));
vi.mock("../../../src/CollageMode.jsx", () => ({ __esModule: true, default: CollageModeMock }));
vi.mock("../../../src/CaptionMode.jsx", () => ({ __esModule: true, default: CaptionModeMock }));
vi.mock("../../../src/CollageVersionMode.jsx", () => ({ __esModule: true, default: CollageVersionModeMock }));
vi.mock("../../../src/GenerateMode.jsx", () => ({ __esModule: true, default: GenerateModeMock }));
vi.mock("../../../src/StaticMode.jsx", () => ({ __esModule: true, default: StaticModeMock }));
vi.mock("../../../src/VideoMode.jsx", () => ({ __esModule: true, default: VideoModeMock }));
vi.mock("../../../src/ThreeKinshipScene.jsx", () => ({ __esModule: true, default: KinshipSceneMock }));
vi.mock("../../../src/AdminPanel.jsx", () => ({ __esModule: true, default: AdminPanelMock }));

import { createModeRenderMap } from "../../../src/modes/createModeRenderMap.js";
import { DisplayModes } from "../../../src/hooks/useDisplayMode.js";

const baseProps = {
  iframeActiveConfig: { layout: "grid" },
  iframeControlsEnabled: true,
  handleLocalIframeConfigApply: vi.fn(),
  iframeTimelineOverlay: <div data-testid="iframe-overlay" />,
  imagesBase: "/imgs/",
  imgId: "img-1",
  slideIntervalMs: 3000,
  navigateToImage: vi.fn(),
  showInfo: true,
  collageRemoteConfig: { panels: [] },
  collageControlsEnabled: false,
  collageRemoteSource: "server",
  caption: "hello",
  videoControllerRef: { current: null },
  clusters: [{ id: "c1" }],
  data: { original_image: "img-1" },
  phylogenyMode: false,
  incubatorMode: false,
  handleFpsUpdate: vi.fn(),
  handleCameraUpdate: vi.fn(),
  pendingPreset: { name: "p1" },
  topbarContent: <div data-testid="top" />,
  screenshotContent: <div data-testid="shot" />,
  clientId: "client-a",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createModeRenderMap", () => {
  it("建構所有 mode 對應並帶入正確 props/overlay", () => {
    const map = createModeRenderMap(baseProps);

    const iframe = map[DisplayModes.IFRAME];
    expect(iframe.component).toBe(IframeModeMock);
    expect(iframe.withCaptureReady).toBe(true);
    expect(iframe.componentProps).toMatchObject({
      config: baseProps.iframeActiveConfig,
      controlsEnabled: true,
      onApplyConfig: baseProps.handleLocalIframeConfigApply,
    });
    expect(iframe.beforeContent).toBe(baseProps.iframeTimelineOverlay);

    const slide = map[DisplayModes.SLIDE];
    expect(slide.component).toBe(SlideModeMock);
    expect(slide.componentProps).toMatchObject({ imagesBase: "/imgs/", anchorImage: "img-1", intervalMs: 3000 });

    const collage = map[DisplayModes.COLLAGE];
    expect(collage.component).toBe(CollageModeMock);
    expect(collage.componentProps).toMatchObject({
      remoteConfig: baseProps.collageRemoteConfig,
      controlsEnabled: false,
      remoteSource: "server",
    });

    const caption = map[DisplayModes.CAPTION];
    expect(caption.componentProps).toEqual({ caption: "hello" });

    const staticMode = map[DisplayModes.STATIC];
    expect(staticMode.withCaptureReady).toBe(true);
    expect(staticMode.componentProps).toMatchObject({ imagesBase: "/imgs/", imgId: "img-1" });

    const video = map[DisplayModes.VIDEO];
    expect(video.componentProps).toMatchObject({ controlRef: baseProps.videoControllerRef });

    const kinship = map[DisplayModes.KINSHIP];
    expect(kinship.component).toBe(KinshipSceneMock);
    expect(kinship.beforeContent).toBe(baseProps.topbarContent);
    expect(kinship.afterContent).toBe(baseProps.screenshotContent);
    expect(kinship.componentProps).toMatchObject({
      clusters: baseProps.clusters,
      data: baseProps.data,
      applyPreset: baseProps.pendingPreset,
    });

    expect(map[DisplayModes.COLLAGE_VERSION]).toEqual({ component: CollageVersionModeMock });
    expect(map[DisplayModes.GENERATE]).toEqual({ component: GenerateModeMock });
    expect(map[DisplayModes.SEARCH]).toEqual({
      component: SearchModeMock,
      componentProps: { imagesBase: baseProps.imagesBase },
    });
    expect(map[DisplayModes.ADMIN].component).toBe(AdminPanelMock);
  });
});
