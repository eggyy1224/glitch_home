import IframeMode from "../IframeMode.jsx";
import SlideMode from "../SlideMode.jsx";
import OrganicRoomScene from "../OrganicRoomScene.jsx";
import SearchMode from "../SearchMode.jsx";
import CollageMode from "../CollageMode.jsx";
import CaptionMode from "../CaptionMode.jsx";
import CollageVersionMode from "../CollageVersionMode.jsx";
import GenerateMode from "../GenerateMode.jsx";
import StaticMode from "../StaticMode.jsx";
import VideoMode from "../VideoMode.jsx";
import KinshipScene from "../ThreeKinshipScene.jsx";
import AdminPanel from "../AdminPanel.jsx";
import { DisplayModes } from "../hooks/useDisplayMode.js";

const modeBaseConfigs = {
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

function buildModeEntry(baseConfig, overrides = {}) {
  const { component, withCaptureReady } = baseConfig;
  const { componentProps, beforeContent, afterContent, ...restOverrides } = overrides;

  const entry = {
    component,
    ...restOverrides,
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
}) {
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
    [DisplayModes.COLLAGE_VERSION]: buildModeEntry(modeBaseConfigs[DisplayModes.COLLAGE_VERSION]),
    [DisplayModes.GENERATE]: buildModeEntry(modeBaseConfigs[DisplayModes.GENERATE]),
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
      },
    }),
  };
}
