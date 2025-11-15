import React from "react";

export default function CameraPresetControls({
  presets = [],
  selectedPresetName,
  onSelectPreset,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}) {
  return (
    <div className="controls">
      <button type="button" onClick={onSavePreset}>
        儲存視角
      </button>
      <select value={selectedPresetName} onChange={(e) => onSelectPreset?.(e.target.value)}>
        <option value="">選擇視角</option>
        {presets.map((preset) => (
          <option key={preset.name} value={preset.name}>
            {preset.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={onApplyPreset} disabled={!selectedPresetName}>
        套用
      </button>
      <button type="button" onClick={onDeletePreset} disabled={!selectedPresetName}>
        刪除
      </button>
    </div>
  );
}
