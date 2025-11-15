import React from "react";
import CameraPresetControls from "./CameraPresetControls.jsx";
import SubtitleCaptionStatus from "./SubtitleCaptionStatus.jsx";

export default function ControlPanel({
  visible,
  modeLabel,
  originalImage,
  clientId,
  relatedCount,
  parentsCount,
  childrenCount,
  siblingsCount,
  ancestorsCount,
  fps,
  cameraInfo,
  presetMessage,
  subtitle,
  caption,
  presets,
  selectedPresetName,
  onSelectPreset,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}) {
  if (!visible) {
    return null;
  }

  const cameraInfoLabel = cameraInfo
    ? `pos(${cameraInfo.position.x.toFixed(1)}, ${cameraInfo.position.y.toFixed(1)}, ${cameraInfo.position.z.toFixed(1)}) ` +
      `target(${cameraInfo.target.x.toFixed(1)}, ${cameraInfo.target.y.toFixed(1)}, ${cameraInfo.target.z.toFixed(1)})`
    : "--";

  return (
    <div className="topbar">
      <div className="badge">模式：{modeLabel}</div>
      <div className="badge">原圖：{originalImage}</div>
      <div className="badge">客戶端：{clientId}</div>
      <div className="badge">關聯：{relatedCount} 張</div>
      <div className="badge">父母：{parentsCount}</div>
      <div className="badge">子代：{childrenCount}</div>
      <div className="badge">兄弟姊妹：{siblingsCount}</div>
      <div className="badge">祖先（去重）：{ancestorsCount}</div>
      <div className="badge">FPS：{fps !== null ? fps.toFixed(1) : "--"}</div>
      <div className="badge">視角：{cameraInfoLabel}</div>
      <CameraPresetControls
        presets={presets}
        selectedPresetName={selectedPresetName}
        onSelectPreset={onSelectPreset}
        onSavePreset={onSavePreset}
        onApplyPreset={onApplyPreset}
        onDeletePreset={onDeletePreset}
      />
      <SubtitleCaptionStatus subtitle={subtitle} caption={caption} />
      {presetMessage && <div className="badge notice">{presetMessage}</div>}
    </div>
  );
}
