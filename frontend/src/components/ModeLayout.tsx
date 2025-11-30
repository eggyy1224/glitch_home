import React from "react";
import SoundPlayer from "../SoundPlayer";
import SubtitleOverlay from "../SubtitleOverlay";
import type { OverlayContent } from "../types/overlay";

interface ModeLayoutProps {
  component?: React.ComponentType<Record<string, unknown>>;
  componentProps?: Record<string, unknown>;
  withCaptureReady?: boolean;
  onCaptureReady?: (...args: unknown[]) => void;
  beforeContent?: React.ReactNode;
  afterContent?: React.ReactNode;
  soundPlayerEnabled?: boolean;
  soundPlayRequest?: unknown;
  onSoundHandled?: () => void;
  showInfo?: boolean;
  subtitle?: OverlayContent | null;
}

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
}: ModeLayoutProps) {
  const shouldInjectCapture =
    Boolean(Component) && Boolean(onCaptureReady) && withCaptureReady && !("onCaptureReady" in componentProps);
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
