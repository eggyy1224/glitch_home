import { lazy, type ComponentType, type MutableRefObject, type ReactNode } from "react";
import { DisplayModes } from "../hooks/useDisplayMode";
import type { OverlayContent } from "../types/overlay";
import type { IframeConfig, VideoController } from "../types/control";
import type { KinshipCameraPose, KinshipCameraPreset, KinshipCluster, KinshipData } from "../types/kinship";
import type { CollageConfig } from "../utils/collageConfig";

export type ModeRenderEntry = {
  component: ComponentType<any>;
  componentProps?: Record<string, unknown>;
  withCaptureReady?: boolean;
  beforeContent?: ReactNode;
  afterContent?: ReactNode;
};

type ModeBaseConfig = {
  component: ComponentType<any>;
  withCaptureReady?: boolean;
};

type ModeEntryOverrides = {
  componentProps?: Record<string, unknown>;
  beforeContent?: ReactNode;
  afterContent?: ReactNode;
};

type ModeRenderMapOptions = {
  iframeActiveConfig: IframeConfig | Partial<IframeConfig> | null;
  iframeControlsEnabled: boolean;
  handleLocalIframeConfigApply: (config: Partial<IframeConfig> | null) => void;
  iframeTimelineOverlay?: ReactNode | null;
  imagesBase: string;
  imgId?: string | null;
  slideIntervalMs?: number;
  navigateToImage: (imageId: string) => void;
  showInfo?: boolean;
  collageRemoteConfig?: CollageConfig | null;
  collageControlsEnabled?: boolean;
  collageRemoteSource?: string | null;
  caption?: OverlayContent | null;
  videoControllerRef?: MutableRefObject<VideoController | null> | null;
  clusters?: KinshipCluster[];
  data?: KinshipData | null;
  phylogenyMode?: boolean;
  incubatorMode?: boolean;
  handleFpsUpdate?: (fps: number | null) => void;
  handleCameraUpdate?: (payload: KinshipCameraPose) => void;
  pendingPreset?: KinshipCameraPreset | null;
  topbarContent?: ReactNode;
  screenshotContent?: ReactNode;
  exhibitionBeforeContent?: ReactNode;
  handleExhibitionCameraUpdate?: (payload: KinshipCameraPose) => void;
  exhibitionPendingPreset?: KinshipCameraPreset | null;
  clientId?: string;
  canGenerate?: boolean;
  canWriteMetadata?: boolean;
  canWriteAssets?: boolean;
  appMode?: string;
  forbidMessage?: string;
  canAnalyze?: boolean;
  canRebuildIndex?: boolean;
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
const ExhibitionMode = lazy(() => import("../ExhibitionMode"));

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
  [DisplayModes.EXHIBITION]: { component: ExhibitionMode },
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
  exhibitionBeforeContent,
  handleExhibitionCameraUpdate,
  exhibitionPendingPreset,
  clientId,
  canGenerate,
  canWriteMetadata,
  canWriteAssets,
  appMode,
  forbidMessage,
  canAnalyze,
  canRebuildIndex,
}: ModeRenderMapOptions): ModeRenderMap {
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
    [DisplayModes.EXHIBITION]: buildModeEntry(modeBaseConfigs[DisplayModes.EXHIBITION], {
      componentProps: {
        onCameraUpdate: handleExhibitionCameraUpdate,
        applyPreset: exhibitionPendingPreset,
      },
      beforeContent: exhibitionBeforeContent,
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
