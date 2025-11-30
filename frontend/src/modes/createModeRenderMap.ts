import { lazy, type ComponentType, type ReactNode } from "react";
import { DisplayModes } from "../hooks/useDisplayMode";

export type ModeRenderEntry = {
  component: ComponentType<unknown>;
  componentProps?: Record<string, unknown>;
  withCaptureReady?: boolean;
  beforeContent?: ReactNode;
  afterContent?: ReactNode;
};

type ModeBaseConfig = {
  component: ComponentType<unknown>;
  withCaptureReady?: boolean;
};

type ModeEntryOverrides = {
  componentProps?: Record<string, unknown>;
  beforeContent?: ReactNode;
  afterContent?: ReactNode;
};

const IframeMode = lazy(() => import("../IframeMode"));
const SlideMode = lazy(() => import("../SlideMode"));
const OrganicRoomScene = lazy(() => import("../OrganicRoomScene"));
const SearchMode = lazy(() => import("../SearchMode"));
const CollageMode = lazy(() => import("../CollageMode"));
const CaptionMode = lazy(() => import("../CaptionMode"));
const CollageVersionMode = lazy(() => import("../CollageVersionMode"));
const GenerateMode = lazy(() => import("../GenerateMode"));
const StaticMode = lazy(() => import("../StaticMode"));
const VideoMode = lazy(() => import("../VideoMode"));
const KinshipScene = lazy(() => import("../ThreeKinshipScene"));
const AdminPanel = lazy(() => import("../AdminPanel"));

const modeBaseConfigs: Record<string, ModeBaseConfig> = {
  [DisplayModes.IFRAME]: { component: IframeMode, withCaptureReady: true },
  [DisplayModes.SLIDE]: { component: SlideMode, withCaptureReady: true },
  [DisplayModes.ORGANIC]: { component: OrganicRoomScene, withCaptureReady: true },
  [DisplayModes.SEARCH]: { component: SearchMode },
  [DisplayModes.COLLAGE]: { component: CollageMode, withCaptureReady: true },
  [DisplayModes.CAPTION]: { component: CaptionMode },
  [DisplayModes.COLLAGE_VERSION]: { component: CollageVersionMode },
  [DisplayModes.GENERATE]: { component: GenerateMode },
  [DisplayModes.STATIC]: { component: StaticMode, withCaptureReady: true },
  [DisplayModes.VIDEO]: { component: VideoMode, withCaptureReady: true },
  [DisplayModes.KINSHIP]: { component: KinshipScene, withCaptureReady: true },
  [DisplayModes.ADMIN]: { component: AdminPanel },
};

function buildModeEntry(baseConfig: ModeBaseConfig, overrides: ModeEntryOverrides = {}): ModeRenderEntry {
  const { component, withCaptureReady } = baseConfig;
  const { componentProps, beforeContent, afterContent } = overrides;

  const entry: ModeRenderEntry = {
    component,
  };

  if (withCaptureReady) {
    entry.withCaptureReady = true;
  }

  if (componentProps !== undefined) {
    entry.componentProps = componentProps;
  }

  if (beforeContent !== undefined) {
    entry.beforeContent = beforeContent;
  }

  if (afterContent !== undefined) {
    entry.afterContent = afterContent;
  }

  return entry;
}

export type ModeRenderMap = Record<string, ModeRenderEntry>;

export function createModeRenderMap({
  iframeActiveConfig,
  iframeControlsEnabled,
  handleLocalIframeConfigApply,
  iframeTimelineOverlay,
  imagesBase,
  imgId,
  slideIntervalMs,
  navigateToImage,
  showInfo,
  collageRemoteConfig,
  collageControlsEnabled,
  collageRemoteSource,
  caption,
  videoControllerRef,
  clusters,
  data,
  phylogenyMode,
  incubatorMode,
  handleFpsUpdate,
  handleCameraUpdate,
  pendingPreset,
  topbarContent,
  screenshotContent,
  clientId,
  canGenerate,
  canWriteMetadata,
  canWriteAssets,
  appMode,
  forbidMessage,
  canAnalyze,
  canRebuildIndex,
}): ModeRenderMap {
  return {
    [DisplayModes.IFRAME]: buildModeEntry(modeBaseConfigs[DisplayModes.IFRAME], {
      componentProps: {
        config: iframeActiveConfig,
        controlsEnabled: iframeControlsEnabled,
        onApplyConfig: iframeControlsEnabled ? handleLocalIframeConfigApply : undefined,
      },
      beforeContent: iframeTimelineOverlay,
    }),
    [DisplayModes.SLIDE]: buildModeEntry(modeBaseConfigs[DisplayModes.SLIDE], {
      componentProps: {
        imagesBase,
        anchorImage: imgId,
        intervalMs: slideIntervalMs,
      },
    }),
    [DisplayModes.ORGANIC]: buildModeEntry(modeBaseConfigs[DisplayModes.ORGANIC], {
      componentProps: {
        imagesBase,
        anchorImage: imgId,
        onSelectImage: navigateToImage,
        showInfo,
      },
    }),
    [DisplayModes.SEARCH]: buildModeEntry(modeBaseConfigs[DisplayModes.SEARCH], {
      componentProps: {
        imagesBase,
      },
    }),
    [DisplayModes.COLLAGE]: buildModeEntry(modeBaseConfigs[DisplayModes.COLLAGE], {
      componentProps: {
        imagesBase,
        anchorImage: imgId,
        remoteConfig: collageRemoteConfig,
        controlsEnabled: collageControlsEnabled,
        remoteSource: collageRemoteSource,
      },
    }),
    [DisplayModes.CAPTION]: buildModeEntry(modeBaseConfigs[DisplayModes.CAPTION], {
      componentProps: {
        caption,
      },
    }),
    [DisplayModes.COLLAGE_VERSION]: buildModeEntry(modeBaseConfigs[DisplayModes.COLLAGE_VERSION], {
      componentProps: {
        canGenerate,
        appMode,
        forbidMessage,
      },
    }),
    [DisplayModes.GENERATE]: buildModeEntry(modeBaseConfigs[DisplayModes.GENERATE], {
      componentProps: {
        canGenerate,
        appMode,
        forbidMessage,
      },
    }),
    [DisplayModes.STATIC]: buildModeEntry(modeBaseConfigs[DisplayModes.STATIC], {
      componentProps: {
        imagesBase,
        imgId,
      },
    }),
    [DisplayModes.VIDEO]: buildModeEntry(modeBaseConfigs[DisplayModes.VIDEO], {
      componentProps: {
        controlRef: videoControllerRef,
      },
    }),
    [DisplayModes.KINSHIP]: buildModeEntry(modeBaseConfigs[DisplayModes.KINSHIP], {
      componentProps: {
        imagesBase,
        clusters,
        data,
        phylogenyMode,
        incubatorMode,
        onPick: navigateToImage,
        onFpsUpdate: handleFpsUpdate,
        onCameraUpdate: handleCameraUpdate,
        applyPreset: pendingPreset,
      },
      beforeContent: topbarContent,
      afterContent: screenshotContent,
    }),
    [DisplayModes.ADMIN]: buildModeEntry(modeBaseConfigs[DisplayModes.ADMIN], {
      componentProps: {
        clientId,
        appMode,
        canWriteMetadata,
        canWriteAssets,
        forbidMessage,
        canAnalyze,
        canRebuildIndex,
      },
    }),
  };
}
