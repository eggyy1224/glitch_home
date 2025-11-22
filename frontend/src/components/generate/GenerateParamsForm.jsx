import React from "react";

export default function GenerateParamsForm({
  prompt,
  onPromptChange,
  strength,
  onStrengthChange,
  outputFormat,
  onOutputFormatChange,
  outputWidth,
  onOutputWidthChange,
  outputHeight,
  onOutputHeightChange,
  outputMaxSide,
  onOutputMaxSideChange,
  resizeMode,
  onResizeModeChange,
  selectedImagesCount,
  count,
  onCountChange,
}) {
  return (
    <div className="generate-params">
      <div className="generate-param">
        <label>Prompt（可選，留空使用預設）</label>
        <textarea value={prompt} onChange={(e) => onPromptChange(e.target.value)} placeholder="輸入自訂 prompt..." />
      </div>
      <div className="generate-param">
        <label>融合強度 (strength): {strength.toFixed(2)}</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={strength}
          onChange={(e) => onStrengthChange(parseFloat(e.target.value))}
        />
      </div>
      <div className="generate-param">
        <label>輸出格式 (output_format)</label>
        <select value={outputFormat} onChange={(e) => onOutputFormatChange(e.target.value)}>
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
        </select>
      </div>
      <div className="generate-param">
        <label>輸出寬度 (output_width，可選)</label>
        <input
          type="number"
          min="1"
          value={outputWidth}
          onChange={(e) => onOutputWidthChange(e.target.value)}
          placeholder="留空不限制"
        />
      </div>
      <div className="generate-param">
        <label>輸出高度 (output_height，可選)</label>
        <input
          type="number"
          min="1"
          value={outputHeight}
          onChange={(e) => onOutputHeightChange(e.target.value)}
          placeholder="留空不限制"
        />
      </div>
      <div className="generate-param">
        <label>最大邊長 (output_max_side，可選)</label>
        <input
          type="number"
          min="1"
          value={outputMaxSide}
          onChange={(e) => onOutputMaxSideChange(e.target.value)}
          placeholder="留空不限制"
        />
      </div>
      <div className="generate-param">
        <label>縮放模式 (resize_mode)</label>
        <select value={resizeMode} onChange={(e) => onResizeModeChange(e.target.value)}>
          <option value="cover">Cover（填滿後裁切）</option>
          <option value="fit">Fit（等比縮放）</option>
        </select>
      </div>
      {selectedImagesCount === 0 && (
        <div className="generate-param">
          <label>隨機抽樣數量 (count)</label>
          <input type="number" min="2" value={count} onChange={(e) => onCountChange(parseInt(e.target.value) || 2)} />
        </div>
      )}
    </div>
  );
}
