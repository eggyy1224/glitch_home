import React, { useState, useEffect, useRef } from "react";
import "./CollageVersionMode.css";
import {
  createImageSearchRequest,
  createTextSearchRequest,
  generateCollageVersionFromNames,
  getCollageProgress,
  listOffspringImages,
} from "./api.js";

const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";
const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function CollageVersionMode() {
  const [availableImages, setAvailableImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingImages, setLoadingImages] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  
  // Progress tracking
  const [taskId, setTaskId] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const progressIntervalRef = useRef(null);
  
  // Search states (名稱搜尋)
  const [textQuery, setTextQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [displayMode, setDisplayMode] = useState("all"); // "all" | "search"
  const textSearchControllerRef = useRef(null);
  
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

  // Mode-specific requirements
  const minRequired = React.useMemo(() => (mode === "rotate-90" ? 1 : 2), [mode]);
  
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

  useEffect(() => {
    return () => {
      if (textSearchControllerRef.current) {
        textSearchControllerRef.current.abort();
      }
    };
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

  const abortTextSearch = () => {
    if (textSearchControllerRef.current) {
      textSearchControllerRef.current.abort();
      textSearchControllerRef.current = null;
    }
  };

  const handleSearchResults = (resultList, emptyMessage) => {
    if (!resultList?.length) {
      setError(emptyMessage);
      setDisplayMode("all");
      return;
    }

    const convertedResults = resultList.map((result) => {
      const cleanId = result.id.replace(/:(en|zh)$/, "");
      return {
        filename: cleanId,
        url: `${IMAGES_BASE}${cleanId}`,
      };
    });
    setSearchResults(convertedResults);
    setDisplayMode("search");
  };

  const resolveImagePath = (query) => {
    const trimmed = query.trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    const exact = availableImages.find((img) => img.filename.toLowerCase() === lower);
    if (exact) return exact.filename;
    const partial = availableImages.find((img) => img.filename.toLowerCase().includes(lower));
    return partial?.filename ?? null;
  };

  const handleTextSearch = async () => {
    if (!textQuery.trim()) {
      setError("請輸入圖片名稱或關鍵字");
      return;
    }

    const imageName = resolveImagePath(textQuery);
    abortTextSearch();

    setSearching(true);
    setError(null);

    try {
      const { controller, promise } = imageName
        ? createImageSearchRequest(imageName, 50)
        : createTextSearchRequest(textQuery, 50);
      textSearchControllerRef.current = controller;

      const searchResultsData = await promise;
      textSearchControllerRef.current = null;

      const resultList = searchResultsData.results || [];
      handleSearchResults(resultList, `未找到與「${textQuery}」相關的圖像`);
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      setError(err.message || "搜尋出錯");
    } finally {
      setSearching(false);
    }
  };
  
  const handleSearchClear = () => {
    abortTextSearch();
    setTextQuery("");
    setSearchResults([]);
    setDisplayMode("all");
    setError(null);
    setSearching(false);
  };
  
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleTextSearch();
    }
  };
  
  // Get images to display
  const displayImages = displayMode === "search" ? searchResults : availableImages;
  
  // Cleanup progress polling on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);
  
  const handleGenerate = async () => {
    if (selectedImages.length < minRequired) {
      setError(`至少需要選擇 ${minRequired} 張圖片`);
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setProgressStage("");
    setProgressMessage("");
    
    // Clear any existing interval
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    
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
      
      const response = await generateCollageVersionFromNames(selectedImages, params);
      const newTaskId = response.task_id;
      setTaskId(newTaskId);
      
      // Start polling for progress
      progressIntervalRef.current = setInterval(async () => {
        try {
          const progressData = await getCollageProgress(newTaskId);
          setProgress(progressData.progress || 0);
          setProgressStage(progressData.stage || "");
          setProgressMessage(progressData.message || "");
          
          if (progressData.completed) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
            
            if (progressData.error) {
              setError(progressData.error);
              setLoading(false);
            } else {
              // Build image URL
              const imageUrl = `${API_BASE}/generated_images/${progressData.output_image}`;
              setResult({
                ...progressData,
                imageUrl,
              });
              setLoading(false);
              setProgress(100);
            }
          }
        } catch (err) {
          console.error("Progress polling error:", err);
          // Don't stop polling on error, just log it
        }
      }, 500); // Poll every 500ms
      
    } catch (err) {
      setError(err.message || "生成失敗");
      setLoading(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  };
  
  return (
    <div className="collage-version-mode">
      <div className="collage-version-container">
        <div className="collage-version-column collage-version-params-pane">
          <h2>拼貼生成</h2>
          
          {/* Parameters */}
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
                  onChange={(e) => setRows(parseInt(e.target.value) || 12)}
                />
              </div>
              <div className="collage-version-param">
                <label>切片行數 (cols)</label>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={cols}
                  onChange={(e) => setCols(parseInt(e.target.value) || 16)}
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
              disabled={loading || selectedImages.length < minRequired}
              className="collage-version-generate"
            >
              {loading ? "生成中..." : "生成拼貼"}
            </button>
            
            {/* Progress Bar */}
            {loading && (
              <div className="collage-version-progress">
                <div className="collage-version-progress-bar-container">
                  <div
                    className="collage-version-progress-bar"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="collage-version-progress-info">
                  <span className="collage-version-progress-stage">
                    {progressStage === "loading" && "載入中"}
                    {progressStage === "standardizing" && "標準化"}
                    {progressStage === "tiling" && "切片"}
                    {progressStage === "matching" && "匹配"}
                    {progressStage === "reassembling" && "重組"}
                    {progressStage === "saving" && "儲存"}
                    {progressStage === "completed" && "完成"}
                    {progressStage === "failed" && "失敗"}
                    {!progressStage && "準備中"}
                  </span>
                  <span className="collage-version-progress-percent">{progress}%</span>
                </div>
                {progressMessage && (
                  <div style={{ fontSize: "11px", color: "#999", marginTop: "4px" }}>
                    {progressMessage}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="collage-version-error">
              {error}
            </div>
          )}
        </div>

        <div className="collage-version-column collage-version-image-pane">
          <div className="collage-version-section">
            <h3>圖片選擇（至少 {minRequired} 張）</h3>

            {/* Search Bar */}
            <div className="collage-version-search">
              <div className="collage-version-search-text">
                <input
                  type="text"
                  value={textQuery}
                  onChange={(e) => setTextQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="輸入圖片名稱或關鍵字，例如：白馬、夜晚、人物"
                  className="collage-version-search-input"
                />
                <div className="collage-version-search-controls">
                  <button
                    type="button"
                    onClick={handleTextSearch}
                    disabled={!textQuery.trim() || searching}
                    className="collage-version-search-btn"
                  >
                    {searching ? "搜尋中..." : "搜尋"}
                  </button>
                  {textQuery && (
                    <button
                      type="button"
                      onClick={handleSearchClear}
                      disabled={searching}
                      className="collage-version-search-clear"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Display Mode Toggle */}
            {displayMode === "search" && (
              <div className="collage-version-display-mode">
                <span className="collage-version-display-mode-label">顯示：搜尋結果 ({searchResults.length} 張)</span>
                <button
                  type="button"
                  onClick={() => setDisplayMode("all")}
                  className="collage-version-display-mode-btn"
                >
                  返回全部
                </button>
              </div>
            )}

            {loadingImages ? (
              <div className="collage-version-loading">
                <div className="collage-version-spinner"></div>
                <p>載入圖片列表中...</p>
              </div>
            ) : (
              <>
                <div className="collage-version-image-grid">
                  {displayImages.map((image) => {
                    const isSelected = selectedImages.includes(image.filename);
                    return (
                      <div
                        key={image.filename}
                        className={`collage-version-image-item ${isSelected ? "selected" : ""}`}
                        onClick={() => handleImageToggle(image.filename)}
                      >
                        <img src={image.url || `${IMAGES_BASE}${image.filename}`} alt={image.filename} />
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
                    <span>已選擇 {selectedImages.length} 張圖片</span>
                    <button
                      type="button"
                      onClick={() => setSelectedImages([])}
                      className="collage-version-clear-selection"
                    >
                      清除選擇
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Result Display */}
        <div className="collage-version-column collage-version-result-pane">
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
