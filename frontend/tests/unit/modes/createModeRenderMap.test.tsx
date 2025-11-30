// @ts-nocheck
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

vi.mock("../../../src/IframeMode", () => ({ __esModule: true, default: IframeModeMock }));
vi.mock("../../../src/SlideMode", () => ({ __esModule: true, default: SlideModeMock }));
vi.mock("../../../src/OrganicRoomScene", () => ({ __esModule: true, default: OrganicRoomSceneMock }));
vi.mock("../../../src/SearchMode", () => ({ __esModule: true, default: SearchModeMock }));
vi.mock("../../../src/CollageMode", () => ({ __esModule: true, default: CollageModeMock }));
vi.mock("../../../src/CaptionMode", () => ({ __esModule: true, default: CaptionModeMock }));
vi.mock("../../../src/CollageVersionMode", () => ({ __esModule: true, default: CollageVersionModeMock }));
vi.mock("../../../src/GenerateMode", () => ({ __esModule: true, default: GenerateModeMock }));
vi.mock("../../../src/StaticMode", () => ({ __esModule: true, default: StaticModeMock }));
vi.mock("../../../src/VideoMode", () => ({ __esModule: true, default: VideoModeMock }));
vi.mock("../../../src/ThreeKinshipScene", () => ({ __esModule: true, default: KinshipSceneMock }));
vi.mock("../../../src/AdminPanel", () => ({ __esModule: true, default: AdminPanelMock }));

import { createModeRenderMap } from "../../../src/modes/createModeRenderMap";
import { DisplayModes } from "../../../src/hooks/useDisplayMode";

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
  canGenerate: true,
  canWriteMetadata: true,
  canWriteAssets: true,
  appMode: "STUDIO",
  forbidMessage: "nope",
  canAnalyze: true,
  canRebuildIndex: true,
};

const resolveComponent = async (component) => {
  if (component?.$$typeof === Symbol.for("react.lazy")) {
    const payloadResult = component._payload?._result;
    if (typeof payloadResult === "function") {
      const mod = await payloadResult();
      return mod.default ?? mod;
    }

    if (payloadResult && typeof payloadResult.then === "function") {
      const mod = await payloadResult;
      return mod.default ?? mod;
    }
  }

  return component;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createModeRenderMap", () => {
  it("建構所有 mode 對應並帶入正確 props/overlay", async () => {
    const map = createModeRenderMap(baseProps);

    const iframe = map[DisplayModes.IFRAME];
    await expect(resolveComponent(iframe.component)).resolves.toBe(IframeModeMock);
    expect(iframe.withCaptureReady).toBe(true);
    expect(iframe.componentProps).toMatchObject({
      config: baseProps.iframeActiveConfig,
      controlsEnabled: true,
      onApplyConfig: baseProps.handleLocalIframeConfigApply,
    });
    expect(iframe.beforeContent).toBe(baseProps.iframeTimelineOverlay);

    const slide = map[DisplayModes.SLIDE];
    await expect(resolveComponent(slide.component)).resolves.toBe(SlideModeMock);
    expect(slide.componentProps).toMatchObject({ imagesBase: "/imgs/", anchorImage: "img-1", intervalMs: 3000 });

    const collage = map[DisplayModes.COLLAGE];
    await expect(resolveComponent(collage.component)).resolves.toBe(CollageModeMock);
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
    await expect(resolveComponent(kinship.component)).resolves.toBe(KinshipSceneMock);
    expect(kinship.beforeContent).toBe(baseProps.topbarContent);
    expect(kinship.afterContent).toBe(baseProps.screenshotContent);
    expect(kinship.componentProps).toMatchObject({
      clusters: baseProps.clusters,
      data: baseProps.data,
      applyPreset: baseProps.pendingPreset,
    });

    await expect(resolveComponent(map[DisplayModes.COLLAGE_VERSION].component)).resolves.toBe(CollageVersionModeMock);
    expect(map[DisplayModes.COLLAGE_VERSION].componentProps).toMatchObject({
      canGenerate: true,
      appMode: "STUDIO",
      forbidMessage: "nope",
    });
    await expect(resolveComponent(map[DisplayModes.GENERATE].component)).resolves.toBe(GenerateModeMock);
    expect(map[DisplayModes.GENERATE].componentProps).toMatchObject({
      canGenerate: true,
      appMode: "STUDIO",
      forbidMessage: "nope",
    });
    expect(map[DisplayModes.SEARCH].componentProps).toEqual({ imagesBase: baseProps.imagesBase });
    await expect(resolveComponent(map[DisplayModes.SEARCH].component)).resolves.toBe(SearchModeMock);
    await expect(resolveComponent(map[DisplayModes.ADMIN].component)).resolves.toBe(AdminPanelMock);
    expect(map[DisplayModes.ADMIN].componentProps).toMatchObject({
      clientId: "client-a",
      appMode: "STUDIO",
      canWriteMetadata: true,
      canWriteAssets: true,
      canAnalyze: true,
      canRebuildIndex: true,
    });
  });
});
