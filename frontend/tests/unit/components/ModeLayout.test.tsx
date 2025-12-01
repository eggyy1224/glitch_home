import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import ModeLayout from "../../../src/components/ModeLayout";
import type { OverlayContent } from "../../../src/types/overlay";
import type { PlayRequest } from "../../../src/SoundPlayer";

const DummyComponent: React.FC<Record<string, unknown>> = vi.fn(() => <div data-testid="dummy" />);

vi.mock("../../../src/SoundPlayer", () => ({
  __esModule: true,
  default: (props: { visible?: boolean; playRequest?: PlayRequest | null }) => (
    <div data-testid="sound-player" data-visible={props.visible ? "1" : "0"} data-play={props.playRequest?.filename ?? ""} />
  ),
}));

vi.mock("../../../src/SubtitleOverlay", () => ({
  __esModule: true,
  default: (props: { subtitle?: OverlayContent | null }) => (
    <div data-testid="subtitle" data-text={props.subtitle?.text ?? ""} />
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ModeLayout", () => {
  it("注入 onCaptureReady 並渲染插槽與播放器", () => {
    const onCaptureReady = vi.fn();
    const beforeContent = <div data-testid="before" />;
    const afterContent = <div data-testid="after" />;
    const subtitle: OverlayContent = {
      text: "hello",
      language: "zh-TW",
      durationSeconds: null,
      expiresAt: null,
      updatedAt: null,
    };

    render(
      <ModeLayout
        component={DummyComponent}
        componentProps={{ foo: "bar" }}
        withCaptureReady
        onCaptureReady={onCaptureReady}
        beforeContent={beforeContent}
        afterContent={afterContent}
        soundPlayerEnabled
        soundPlayRequest={{ filename: "tone.wav" }}
        onSoundHandled={vi.fn()}
        showInfo
        subtitle={subtitle}
      />,
    );

    expect(DummyComponent).toHaveBeenCalledWith(
      expect.objectContaining({ foo: "bar", onCaptureReady }),
      expect.anything(),
    );
    expect(onCaptureReady).not.toHaveBeenCalled(); // 只應被傳入
    expect(document.querySelector('[data-testid="before"]')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="after"]')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="sound-player"]')).toHaveAttribute("data-visible", "1");
    expect(document.querySelector('[data-testid="subtitle"]')).toHaveAttribute("data-text", "hello");
  });

  it("若 component 未提供且沒有 captureReady 就不渲染 component", () => {
    const { container } = render(<ModeLayout subtitle={null} />);
    expect(container.textContent).toBe("");
  });
});
