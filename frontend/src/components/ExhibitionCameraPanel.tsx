import React from "react";
import CameraPresetControls from "./CameraPresetControls";
import type { CameraInfo, CameraPreset } from "../types/control";

interface ExhibitionCameraPanelProps {
  visible: boolean;
  cameraInfo: CameraInfo | null;
  presets: CameraPreset[];
  selectedPresetName: string;
  presetMessage?: string | null;
  onSelectPreset: (name: string) => void;
  onSavePreset: () => void;
  onApplyPreset: () => void;
  onDeletePreset: () => void;
}

export default function ExhibitionCameraPanel({
  visible,
  cameraInfo,
  presets,
  selectedPresetName,
  presetMessage,
  onSelectPreset,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}: ExhibitionCameraPanelProps) {
  if (!visible) return null;

  const cameraInfoLabel = cameraInfo
    ? `pos(${cameraInfo.position.x.toFixed(2)}, ${cameraInfo.position.y.toFixed(2)}, ${cameraInfo.position.z.toFixed(
        2,
      )}) target(${cameraInfo.target.x.toFixed(2)}, ${cameraInfo.target.y.toFixed(2)}, ${cameraInfo.target.z.toFixed(
        2,
      )})`
    : "--";

  return (
    <div className="topbar" style={{ flexWrap: "wrap", rowGap: 8 }}>
      <div className="badge">展場視角控制</div>
      <div className="badge">視角：{cameraInfoLabel}</div>
      <CameraPresetControls
        presets={presets}
        selectedPresetName={selectedPresetName}
        onSelectPreset={onSelectPreset}
        onSavePreset={onSavePreset}
        onApplyPreset={onApplyPreset}
        onDeletePreset={onDeletePreset}
      />
      {presetMessage && <div className="badge notice">{presetMessage}</div>}
    </div>
  );
}
