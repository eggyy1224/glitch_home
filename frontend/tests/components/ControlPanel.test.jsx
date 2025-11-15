import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ControlPanel from "../../src/components/ControlPanel.jsx";

const baseProps = {
  visible: true,
  modeLabel: "3D 景觀",
  originalImage: "offspring.png",
  clientId: "viewer",
  relatedCount: 2,
  parentsCount: 1,
  childrenCount: 3,
  siblingsCount: 4,
  ancestorsCount: 5,
  fps: 30,
  cameraInfo: {
    position: { x: 1, y: 2, z: 3 },
    target: { x: 4, y: 5, z: 6 },
  },
  presets: [{ name: "center" }],
  selectedPresetName: "center",
  onSelectPreset: vi.fn(),
  onSavePreset: vi.fn(),
  onApplyPreset: vi.fn(),
  onDeletePreset: vi.fn(),
  presetMessage: "完成",
  subtitle: "字幕",
  caption: "標題",
};

describe("ControlPanel", () => {
  it("renders stats, presets, and status badges when visible", () => {
    render(<ControlPanel {...baseProps} />);

    expect(screen.getByText("模式：3D 景觀")).toBeInTheDocument();
    expect(screen.getByText("原圖：offspring.png")).toBeInTheDocument();
    expect(screen.getByText("字幕：字幕")).toBeInTheDocument();
    expect(screen.getByText("標題：標題")).toBeInTheDocument();
    expect(screen.getByText("完成")).toBeInTheDocument();
  });

  it("invokes callbacks when preset is changed", () => {
    const onSelectPreset = vi.fn();
    render(<ControlPanel {...baseProps} onSelectPreset={onSelectPreset} />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "center" } });
    expect(onSelectPreset).toHaveBeenCalledWith("center");
  });

  it("does not render when hidden", () => {
    const { container } = render(<ControlPanel {...baseProps} visible={false} />);
    expect(container.firstChild).toBeNull();
  });
});
