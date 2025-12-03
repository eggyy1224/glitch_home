import React from "react";

interface ParamsFormProps {
  rows: number;
  cols: number;
  mode: string;
  seed: number;
  resizeW: number;
  padPx: number;
  jitterPx: number;
  rotateDeg: number;
  format: string;
  quality: number;
  setRows: (value: number) => void;
  setCols: (value: number) => void;
  setMode: (value: string) => void;
  setSeed: (value: number) => void;
  setResizeW: (value: number) => void;
  setPadPx: (value: number) => void;
  setJitterPx: (value: number) => void;
  setRotateDeg: (value: number) => void;
  setFormat: (value: string) => void;
  setQuality: (value: number) => void;
}

export function ParamsForm({
  rows,
  cols,
  mode,
  seed,
  resizeW,
  padPx,
  jitterPx,
  rotateDeg,
  format,
  quality,
  setRows,
  setCols,
  setMode,
  setSeed,
  setResizeW,
  setPadPx,
  setJitterPx,
  setRotateDeg,
  setFormat,
  setQuality,
}: ParamsFormProps) {
  return (
    <div className="collage-version-section">
      <h3>參數設定</h3>
      <div className="collage-version-params">
        <div className="collage-version-param">
          <label>切片列數 (rows)</label>
          <input
            type="number"
            min="1"
            max="300"
            value={rows}
            onChange={(e) => setRows(parseInt(e.target.value, 10) || 12)}
          />
        </div>
        <div className="collage-version-param">
          <label>切片行數 (cols)</label>
          <input
            type="number"
            min="1"
            max="300"
            value={cols}
            onChange={(e) => setCols(parseInt(e.target.value, 10) || 16)}
          />
        </div>
        <div className="collage-version-param">
          <label>匹配模式</label>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="kinship">親緣匹配 (kinship)</option>
            <option value="random">隨機 (random)</option>
            <option value="wave">波紋擴散 (wave)</option>
            <option value="luminance">亮度匹配 (luminance)</option>
            <option value="source-cluster">來源聚類 (source-cluster)</option>
            <option value="weave">編織模式 (weave)</option>
            <option value="weave-vertical">垂直編織 (weave-vertical)</option>
            <option value="rotate-90">每格右轉 90° (rotate-90)</option>
          </select>
        </div>
        <div className="collage-version-param">
          <label>隨機種子 (seed)</label>
          <input
            type="number"
            min="0"
            max="2147483647"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value, 10) || Math.floor(Math.random() * 1000000))}
          />
        </div>
        <div className="collage-version-param">
          <label>目標寬度 (resize_w)</label>
          <input
            type="number"
            min="256"
            max="8192"
            value={resizeW}
            onChange={(e) => setResizeW(parseInt(e.target.value, 10) || 2048)}
          />
        </div>
        <div className="collage-version-param">
          <label>間距 (pad_px)</label>
          <input
            type="number"
            min="0"
            max="100"
            value={padPx}
            onChange={(e) => setPadPx(parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div className="collage-version-param">
          <label>隨機位移 (jitter_px)</label>
          <input
            type="number"
            min="0"
            max="50"
            value={jitterPx}
            onChange={(e) => setJitterPx(parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div className="collage-version-param">
          <label>旋轉角度 (rotate_deg)</label>
          <input
            type="number"
            min="0"
            max="45"
            value={rotateDeg}
            onChange={(e) => setRotateDeg(parseInt(e.target.value, 10) || 0)}
          />
        </div>
        <div className="collage-version-param">
          <label>輸出格式</label>
          <select value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="png">PNG</option>
            <option value="jpg">JPG</option>
            <option value="webp">WebP</option>
          </select>
        </div>
        <div className="collage-version-param">
          <label>品質 (quality)</label>
          <input
            type="number"
            min="1"
            max="100"
            value={quality}
            onChange={(e) => setQuality(parseInt(e.target.value, 10) || 92)}
          />
        </div>
      </div>
    </div>
  );
}
