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
    [DisplayModes.IFRAME]: {
      component: IframeMode,
      withCaptureReady: true,
      componentProps: {
        config: iframeActiveConfig,
        controlsEnabled: iframeControlsEnabled,
        onApplyConfig: iframeControlsEnabled ? handleLocalIframeConfigApply : undefined,
      },
      beforeContent: iframeTimelineOverlay,
    },
    [DisplayModes.SLIDE]: {
      component: SlideMode,
      withCaptureReady: true,
      componentProps: {
        imagesBase,
        anchorImage: imgId,
        intervalMs: slideIntervalMs,
      },
    },
    [DisplayModes.ORGANIC]: {
      component: OrganicRoomScene,
      withCaptureReady: true,
      componentProps: {
        imagesBase,
        anchorImage: imgId,
        onSelectImage: navigateToImage,
        showInfo,
      },
    },
    [DisplayModes.SEARCH]: {
      component: SearchMode,
      componentProps: {
        imagesBase,
      },
    },
    [DisplayModes.COLLAGE]: {
      component: CollageMode,
      withCaptureReady: true,
      componentProps: {
        imagesBase,
        anchorImage: imgId,
        remoteConfig: collageRemoteConfig,
        controlsEnabled: collageControlsEnabled,
        remoteSource: collageRemoteSource,
      },
    },
    [DisplayModes.CAPTION]: {
      component: CaptionMode,
      componentProps: {
        caption,
      },
    },
    [DisplayModes.COLLAGE_VERSION]: {
      component: CollageVersionMode,
    },
    [DisplayModes.GENERATE]: {
      component: GenerateMode,
    },
    [DisplayModes.STATIC]: {
      component: StaticMode,
      withCaptureReady: true,
      componentProps: {
        imagesBase,
        imgId,
      },
    },
    [DisplayModes.VIDEO]: {
      component: VideoMode,
      withCaptureReady: true,
      componentProps: {
        controlRef: videoControllerRef,
      },
    },
    [DisplayModes.KINSHIP]: {
      component: KinshipScene,
      withCaptureReady: true,
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
    },
    [DisplayModes.ADMIN]: {
      component: AdminPanel,
      componentProps: {
        clientId,
      },
    },
  };
}
