import React, { useState, useEffect } from "react";
import "./CollageVersionMode.css";
import { generateCollageVersionFromNames, listOffspringImages } from "./api.js";

const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";

export default function CollageVersionMode() {
  const [availableImages, setAvailableImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingImages, setLoadingImages] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  
  // Parameters
  const [rows, setRows] = useState(12);
  const [cols, setCols] = useState(16);
  const [mode, setMode] = useState("kinship");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1000000));
  const [resizeW, setResizeW] = useState(2048);
  const [padPx, setPadPx] = useState(0);
  const [jitterPx, setJitterPx] = useState(0);
  const [rotateDeg, setRotateDeg] = useState(0);
  const [format, setFormat] = useState("png");
  const [quality, setQuality] = useState(92);
  
  // Load available images
  useEffect(() => {
    const loadImages = async () => {
      try {
        setLoadingImages(true);
        const data = await listOffspringImages();
        setAvailableImages(data.images || []);
      } catch (err) {
        setError(`載入圖片列表失敗: ${err.message}`);
      } finally {
        setLoadingImages(false);
      }
    };
    loadImages();
  }, []);
  
  const handleImageToggle = (imageName) => {
    setSelectedImages((prev) => {
      if (prev.includes(imageName)) {
        return prev.filter((name) => name !== imageName);
      } else {
        return [...prev, imageName];
      }
    });
    setError(null);
  };
  
  const handleGenerate = async () => {
    if (selectedImages.length < 2) {
      setError("至少需要選擇 2 張圖片");
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const params = {
        rows,
        cols,
        mode,
        seed,
        resize_w: resizeW,
        pad_px: padPx,
        jitter_px: jitterPx,
        rotate_deg: rotateDeg,
        format,
        quality,
        return_map: false,
      };
      
      const result = await generateCollageVersionFromNames(selectedImages, params);
      setResult(result);
    } catch (err) {
      setError(err.message || "生成失敗");
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="collage-version-mode">
      <div className="collage-version-container">
        <div className="collage-version-left">
          <h2>拼貼生成</h2>
          
          {/* Image Selection */}
          <div className="collage-version-section">
            <h3>選擇圖片（至少 2 張）</h3>
            {loadingImages ? (
              <div className="collage-version-loading">
                <div className="collage-version-spinner"></div>
                <p>載入圖片列表中...</p>
              </div>
            ) : (
              <>
                <div className="collage-version-image-grid">
                  {availableImages.map((image) => {
                    const isSelected = selectedImages.includes(image.filename);
                    return (
                      <div
                        key={image.filename}
                        className={`collage-version-image-item ${isSelected ? "selected" : ""}`}
                        onClick={() => handleImageToggle(image.filename)}
                      >
                        <img src={`${IMAGES_BASE}${image.filename}`} alt={image.filename} />
                        <div className="collage-version-image-overlay">
                          {isSelected && <span className="collage-version-check">✓</span>}
                        </div>
                        <div className="collage-version-image-name">{image.filename}</div>
                      </div>
                    );
                  })}
                </div>
                {selectedImages.length > 0 && (
                  <div className="collage-version-selected-count">
                    已選擇 {selectedImages.length} 張圖片
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Parameters */}
          <div className="collage-version-section">
            <h3>參數設定</h3>
            <div className="collage-version-params">
              <div className="collage-version-param">
                <label>切片列數 (rows)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={rows}
                  onChange={(e) => setRows(parseInt(e.target.value) || 12)}
                />
              </div>
              <div className="collage-version-param">
                <label>切片行數 (cols)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={cols}
                  onChange={(e) => setCols(parseInt(e.target.value) || 16)}
                />
              </div>
              <div className="collage-version-param">
                <label>匹配模式</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="kinship">親緣匹配 (kinship)</option>
                  <option value="random">隨機 (random)</option>
                </select>
              </div>
              <div className="collage-version-param">
                <label>隨機種子 (seed)</label>
                <input
                  type="number"
                  min="0"
                  max="2147483647"
                  value={seed}
                  onChange={(e) => setSeed(parseInt(e.target.value) || Math.floor(Math.random() * 1000000))}
                />
              </div>
              <div className="collage-version-param">
                <label>目標寬度 (resize_w)</label>
                <input
                  type="number"
                  min="256"
                  max="8192"
                  value={resizeW}
                  onChange={(e) => setResizeW(parseInt(e.target.value) || 2048)}
                />
              </div>
              <div className="collage-version-param">
                <label>間距 (pad_px)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={padPx}
                  onChange={(e) => setPadPx(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="collage-version-param">
                <label>隨機位移 (jitter_px)</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={jitterPx}
                  onChange={(e) => setJitterPx(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="collage-version-param">
                <label>旋轉角度 (rotate_deg)</label>
                <input
                  type="number"
                  min="0"
                  max="45"
                  value={rotateDeg}
                  onChange={(e) => setRotateDeg(parseInt(e.target.value) || 0)}
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
                  onChange={(e) => setQuality(parseInt(e.target.value) || 92)}
                />
              </div>
            </div>
          </div>
          
          {/* Generate Button */}
          <div className="collage-version-section">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || selectedImages.length < 2}
              className="collage-version-generate"
            >
              {loading ? "生成中..." : "生成拼貼"}
            </button>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="collage-version-error">
              {error}
            </div>
          )}
        </div>
        
        {/* Result Display */}
        <div className="collage-version-right">
          <h3>結果</h3>
          {loading && (
            <div className="collage-version-loading">
              <div className="collage-version-spinner"></div>
              <p>正在生成拼貼...</p>
            </div>
          )}
          {result && (
            <div className="collage-version-result">
              <img src={result.imageUrl} alt="Generated Collage" />
              <div className="collage-version-result-info">
                <p>檔名: {result.output_image}</p>
                <p>尺寸: {result.width} × {result.height}</p>
                <p>格式: {result.output_format}</p>
                <p>親代圖: {result.parents.join(", ")}</p>
              </div>
            </div>
          )}
          {!loading && !result && (
            <div className="collage-version-placeholder">
              <p>生成結果將顯示在這裡</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
