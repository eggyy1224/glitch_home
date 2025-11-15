import React from "react";
import SoundPlayer from "../SoundPlayer.jsx";
import SubtitleOverlay from "../SubtitleOverlay.jsx";

export default function ModeLayout({
  component: Component,
  componentProps = {},
  withCaptureReady = false,
  onCaptureReady,
  beforeContent = null,
  afterContent = null,
  soundPlayerEnabled,
  soundPlayRequest,
  onSoundHandled,
  showInfo,
  subtitle,
}) {
  const shouldInjectCapture =
    Boolean(Component) && Boolean(onCaptureReady) && withCaptureReady && !componentProps.onCaptureReady;
  const renderedProps = shouldInjectCapture
    ? {
        ...componentProps,
        onCaptureReady,
      }
    : componentProps;

  return (
    <>
      {beforeContent}
      {Component && <Component {...renderedProps} />}
      {afterContent}
      {soundPlayerEnabled && (
        <SoundPlayer
          playRequest={soundPlayerEnabled ? soundPlayRequest : null}
          onPlayHandled={onSoundHandled}
          visible={showInfo}
        />
      )}
      <SubtitleOverlay subtitle={subtitle} />
    </>
  );
}
