import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CollageConfig } from "../../../src/utils/collageConfig";
import type { OverlayContent } from "../../../src/types/overlay";
import type { KinshipCluster, KinshipData } from "../../../src/types/kinship";

const {
  IframeModeMock,
  MatrixModeMock,
  SlideModeMock,
  VjModeMock,
  VjVideoModeMock,
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
  const stub = (name: string) => vi.fn(() => name);
    return {
      IframeModeMock: stub("IframeMode"),
      MatrixModeMock: stub("MatrixMode"),
      SlideModeMock: stub("SlideMode"),
      VjModeMock: stub("VjMode"),
      VjVideoModeMock: stub("VjVideoMode"),
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
vi.mock("../../../src/MatrixMode", () => ({ __esModule: true, default: MatrixModeMock }));
vi.mock("../../../src/SlideMode", () => ({ __esModule: true, default: SlideModeMock }));
vi.mock("../../../src/VjMode", () => ({ __esModule: true, default: VjModeMock }));
vi.mock("../../../src/VjVideoMode", () => ({ __esModule: true, default: VjVideoModeMock }));
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
import { createCollageConfig } from "../../testUtils";

const collageRemoteConfig: CollageConfig = createCollageConfig();
const clusters: KinshipCluster[] = [{ id: "c1", anchor: { x: 0, y: 0, z: 0 }, original: "seed.png" }];
const kinshipData: KinshipData = { original_image: "img-1", children: [], siblings: [], parents: [] };
const caption: OverlayContent = { text: "hello", language: null, durationSeconds: null, expiresAt: null, updatedAt: null };

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
  collageRemoteConfig,
  collageControlsEnabled: false,
  collageRemoteSource: "server",
  caption,
  videoControllerRef: { current: null },
  clusters,
  data: kinshipData,
  phylogenyMode: false,
  incubatorMode: false,
  handleFpsUpdate: vi.fn(),
  handleCameraUpdate: vi.fn(),
  pendingPreset: { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
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

const resolveComponent = async (component: React.ComponentType<any> | React.LazyExoticComponent<any> | null) => {
  const lazyComponent = component as any;
  if (lazyComponent?.$$typeof === Symbol.for("react.lazy")) {
    const payloadResult = lazyComponent._payload?._result;
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

    const matrix = map[DisplayModes.MATRIX];
    await expect(resolveComponent(matrix.component)).resolves.toBe(MatrixModeMock);
    expect(matrix.componentProps).toMatchObject({ imagesBase: "/imgs/", anchorImage: "img-1", intervalMs: 3000 });

    const vj = map[DisplayModes.VJ];
    await expect(resolveComponent(vj.component)).resolves.toBe(VjModeMock);
    expect(vj.componentProps).toMatchObject({ imagesBase: "/imgs/", anchorImage: "img-1" });

    const vjVideo = map[DisplayModes.VJ_VIDEO];
    await expect(resolveComponent(vjVideo.component)).resolves.toBe(VjVideoModeMock);
    expect(vjVideo.withCaptureReady).toBe(true);
    expect(vjVideo.componentProps).toBeUndefined();

    const collage = map[DisplayModes.COLLAGE];
    await expect(resolveComponent(collage.component)).resolves.toBe(CollageModeMock);
    expect(collage.componentProps).toMatchObject({
      remoteConfig: baseProps.collageRemoteConfig,
      controlsEnabled: false,
      remoteSource: "server",
    });

    const captionEntry = map[DisplayModes.CAPTION];
    expect(captionEntry.componentProps).toEqual({ caption });

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
