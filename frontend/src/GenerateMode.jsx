import React, { useState, useEffect, useRef } from "react";
import "./GenerateMode.css";
import { generateMixTwo, listOffspringImages, searchImagesByText, searchImagesByImage } from "./api.js";

const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";
const API_BASE = import.meta.env.VITE_API_BASE || "";

const ensureTrailingSlash = (value) => {
  if (!value) return "/";
  return value.endsWith("/") ? value : `${value}/`;
};

const buildImageUrl = (base, identifier) => {
  if (!identifier) return "";
  const normalizedIdentifier = identifier.replace(/^\/+/, "");
  if (!base) {
    return `/${normalizedIdentifier}`;
  }
  return `${ensureTrailingSlash(base)}${normalizedIdentifier}`;
};

const extractImageIdentifier = (value) => {
  if (!value) return "";
  const sanitized = String(value).split("?")[0];
  const parts = sanitized.split("/");
  return parts[parts.length - 1] || "";
};

const resolveImageIdentifier = (image) => {
  if (!image) return "";
  return image.filename || extractImageIdentifier(image.url) || "";
};

const resolveImageUrl = (image) => {
  const identifier = resolveImageIdentifier(image);
  if (!identifier) {
    return image?.url || "";
  }
  return buildImageUrl(IMAGES_BASE, identifier);
};

export default function GenerateMode() {
  const [availableImages, setAvailableImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingImages, setLoadingImages] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  
  // Search states
  const [searchType, setSearchType] = useState("text"); // "text" | "image"
  const [textQuery, setTextQuery] = useState("");
  const [searchFile, setSearchFile] = useState(null);
  const [searchPreview, setSearchPreview] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [displayMode, setDisplayMode] = useState("all"); // "all" | "search"
  const fileInputRef = useRef(null);
  
  // Parameters
  const [prompt, setPrompt] = useState("");
  const [strength, setStrength] = useState(0.5);
  const [outputFormat, setOutputFormat] = useState("png");
  const [outputWidth, setOutputWidth] = useState("");
  const [outputHeight, setOutputHeight] = useState("");
  const [outputMaxSide, setOutputMaxSide] = useState("");
  const [resizeMode, setResizeMode] = useState("cover");
  const [count, setCount] = useState(2);
  
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
  
  // Search handlers
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSearchFile(file);
    setError(null);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setSearchPreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };
  
  const handleImageSearch = async () => {
    if (!searchFile) {
      setError("請先選擇圖片");
      return;
    }
    
    setSearching(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append("file", searchFile);
      
      const uploadUrl = `${API_BASE}/api/screenshots`;
      
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });
      
      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(`圖片上傳失敗 (${uploadRes.status}): ${errorText}`);
      }
      
      const uploadData = await uploadRes.json();
      const uploadedPath = uploadData.absolute_path || uploadData.relative_path;
      
      if (!uploadedPath) {
        throw new Error("上傳成功但無法取得檔案路徑");
      }
      
      let searchPath = uploadedPath;
      if (uploadData.original_filename) {
        searchPath = `backend/offspring_images/${uploadData.original_filename}`;
      }
      
      try {
        const searchResultsData = await searchImagesByImage(searchPath, 50);
        const resultList = searchResultsData.results || [];
        
        if (resultList.length === 0) {
          setError("搜尋完成，但沒有找到相似的圖像");
          setDisplayMode("all");
        } else {
          // Convert search results to image format
          const convertedResults = resultList.map((result) => {
            const cleanId = result.id.replace(/:(en|zh)$/, "");
            return {
              filename: cleanId,
              url: buildImageUrl(IMAGES_BASE, cleanId),
            };
          });
          setSearchResults(convertedResults);
          setDisplayMode("search");
        }
      } catch (searchErr) {
        if (searchPath !== uploadedPath) {
          const searchResultsData = await searchImagesByImage(uploadedPath, 50);
          const resultList = searchResultsData.results || [];
          if (resultList.length === 0) {
            setError("搜尋完成，但沒有找到相似的圖像");
            setDisplayMode("all");
          } else {
            const convertedResults = resultList.map((result) => {
              const cleanId = result.id.replace(/:(en|zh)$/, "");
              return {
                filename: cleanId,
                url: buildImageUrl(IMAGES_BASE, cleanId),
              };
            });
            setSearchResults(convertedResults);
            setDisplayMode("search");
          }
        } else {
          throw searchErr;
        }
      }
    } catch (err) {
      setError(err.message || "搜尋出錯");
    } finally {
      setSearching(false);
    }
  };
  
  const handleTextSearch = async () => {
    if (!textQuery.trim()) {
      setError("請輸入搜尋詞");
      return;
    }
    
    setSearching(true);
    setError(null);
    
    try {
      const searchResultsData = await searchImagesByText(textQuery, 50);
      const resultList = searchResultsData.results || [];
      
      if (resultList.length === 0) {
        setError(`未找到與「${textQuery}」相關的圖像`);
        setDisplayMode("all");
      } else {
        // Convert search results to image format
        const convertedResults = resultList.map((result) => {
          const cleanId = result.id.replace(/:(en|zh)$/, "");
          return {
            filename: cleanId,
            url: buildImageUrl(IMAGES_BASE, cleanId),
          };
        });
        setSearchResults(convertedResults);
        setDisplayMode("search");
      }
    } catch (err) {
      setError(err.message || "搜尋出錯");
    } finally {
      setSearching(false);
    }
  };
  
  const handleSearchClear = () => {
    setTextQuery("");
    setSearchFile(null);
    setSearchPreview(null);
    setSearchResults([]);
    setDisplayMode("all");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleTextSearch();
    }
  };
  
  // Get images to display
  const displayImages = displayMode === "search" ? searchResults : availableImages;
  
  const handleGenerate = async () => {
    // If no images selected, use count (random sampling)
    if (selectedImages.length < 2 && selectedImages.length > 0) {
      setError("至少需要選擇 2 張圖片，或留空使用隨機抽樣");
      return;
    }
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const params = {};
      
      // If images selected, use parents; otherwise use count
      if (selectedImages.length >= 2) {
        params.parents = selectedImages;
      } else {
        params.count = count;
      }
      
      // Add optional parameters
      if (prompt.trim()) {
        params.prompt = prompt.trim();
      }
      if (strength !== null && strength !== undefined) {
        params.strength = strength;
      }
      if (outputFormat) {
        params.output_format = outputFormat;
      }
      if (outputWidth) {
        params.output_width = parseInt(outputWidth);
      }
      if (outputHeight) {
        params.output_height = parseInt(outputHeight);
      }
      if (outputMaxSide) {
        params.output_max_side = parseInt(outputMaxSide);
      }
      if (resizeMode) {
        params.resize_mode = resizeMode;
      }
      
      const response = await generateMixTwo(params);
      const imageIdentifier =
        extractImageIdentifier(response.output_image) ||
        extractImageIdentifier(response.output_image_path) ||
        extractImageIdentifier(response.imageUrl);
      const resolvedImageUrl = imageIdentifier
        ? buildImageUrl(IMAGES_BASE, imageIdentifier)
        : response.imageUrl || "";
      
      setResult({
        ...response,
        imageUrl: resolvedImageUrl,
      });
      setLoading(false);
    } catch (err) {
      setError(err.message || "生成失敗");
      setLoading(false);
    }
  };
  
  return (
    <div className="generate-mode">
      <div className="generate-container">
        <div className="generate-left">
          <h2>圖像生成</h2>
          
          {/* Image Selection */}
          <div className="generate-section">
            <h3>選擇圖片（至少 2 張，或留空使用隨機抽樣）</h3>
            
            {/* Search Bar */}
            <div className="generate-search">
              <div className="generate-search-mode">
                <button
                  type="button"
                  className={`generate-search-mode-btn ${searchType === "text" ? "active" : ""}`}
                  onClick={() => setSearchType("text")}
                >
                  📝 文字搜尋
                </button>
                <button
                  type="button"
                  className={`generate-search-mode-btn ${searchType === "image" ? "active" : ""}`}
                  onClick={() => setSearchType("image")}
                >
                  📸 圖片搜尋
                </button>
              </div>
              
              {searchType === "text" ? (
                <div className="generate-search-text">
                  <input
                    type="text"
                    value={textQuery}
                    onChange={(e) => setTextQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="輸入搜尋詞... 例如：白馬、夜晚、人物"
                    className="generate-search-input"
                  />
                  <div className="generate-search-controls">
                    <button
                      type="button"
                      onClick={handleTextSearch}
                      disabled={!textQuery.trim() || searching}
                      className="generate-search-btn"
                    >
                      {searching ? "搜尋中..." : "搜尋"}
                    </button>
                    {textQuery && (
                      <button
                        type="button"
                        onClick={handleSearchClear}
                        disabled={searching}
                        className="generate-search-clear"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="generate-search-image">
                  {searchPreview ? (
                    <div className="generate-search-preview">
                      <img src={searchPreview} alt="預覽" />
                      <p>{searchFile.name}</p>
                    </div>
                  ) : (
                    <div
                      className="generate-search-upload"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="generate-search-upload-icon">📸</div>
                      <p>點擊上傳圖片或拖放</p>
                      <p className="generate-search-upload-hint">支援 PNG, JPG, JPEG</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleFileSelect}
                    style={{ display: "none" }}
                  />
                  <div className="generate-search-controls">
                    <button
                      type="button"
                      onClick={handleImageSearch}
                      disabled={!searchFile || searching}
                      className="generate-search-btn"
                    >
                      {searching ? "搜尋中..." : "搜尋"}
                    </button>
                    {searchFile && (
                      <button
                        type="button"
                        onClick={handleSearchClear}
                        disabled={searching}
                        className="generate-search-clear"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Display Mode Toggle */}
            {displayMode === "search" && (
              <div className="generate-display-mode">
                <span className="generate-display-mode-label">顯示：搜尋結果 ({searchResults.length} 張)</span>
                <button
                  type="button"
                  onClick={() => setDisplayMode("all")}
                  className="generate-display-mode-btn"
                >
                  返回全部
                </button>
              </div>
            )}
            
            {loadingImages ? (
              <div className="generate-loading">
                <div className="generate-spinner"></div>
                <p>載入圖片列表中...</p>
              </div>
            ) : (
              <>
                <div className="generate-image-grid">
                  {displayImages.map((image) => {
                    const isSelected = selectedImages.includes(image.filename);
                    const imageSrc = resolveImageUrl(image);
                    return (
                      <div
                        key={image.filename}
                        className={`generate-image-item ${isSelected ? "selected" : ""}`}
                        onClick={() => handleImageToggle(image.filename)}
                      >
                        <img src={imageSrc} alt={image.filename} />
                        <div className="generate-image-overlay">
                          {isSelected && <span className="generate-check">✓</span>}
                        </div>
                        <div className="generate-image-name">{image.filename}</div>
                      </div>
                    );
                  })}
                </div>
                {selectedImages.length > 0 && (
                  <div className="generate-selected-count">
                    已選擇 {selectedImages.length} 張圖片
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Parameters */}
          <div className="generate-section">
            <h3>參數設定</h3>
            <div className="generate-params">
              <div className="generate-param">
                <label>Prompt（可選，留空使用預設）</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="輸入自訂 prompt..."
                />
              </div>
              <div className="generate-param">
                <label>融合強度 (strength): {strength.toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={strength}
                  onChange={(e) => setStrength(parseFloat(e.target.value))}
                />
              </div>
              <div className="generate-param">
                <label>輸出格式 (output_format)</label>
                <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value)}>
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
                  onChange={(e) => setOutputWidth(e.target.value)}
                  placeholder="留空不限制"
                />
              </div>
              <div className="generate-param">
                <label>輸出高度 (output_height，可選)</label>
                <input
                  type="number"
                  min="1"
                  value={outputHeight}
                  onChange={(e) => setOutputHeight(e.target.value)}
                  placeholder="留空不限制"
                />
              </div>
              <div className="generate-param">
                <label>最大邊長 (output_max_side，可選)</label>
                <input
                  type="number"
                  min="1"
                  value={outputMaxSide}
                  onChange={(e) => setOutputMaxSide(e.target.value)}
                  placeholder="留空不限制"
                />
              </div>
              <div className="generate-param">
                <label>縮放模式 (resize_mode)</label>
                <select value={resizeMode} onChange={(e) => setResizeMode(e.target.value)}>
                  <option value="cover">Cover（填滿後裁切）</option>
                  <option value="fit">Fit（等比縮放）</option>
                </select>
              </div>
              {selectedImages.length === 0 && (
                <div className="generate-param">
                  <label>隨機抽樣數量 (count)</label>
                  <input
                    type="number"
                    min="2"
                    value={count}
                    onChange={(e) => setCount(parseInt(e.target.value) || 2)}
                  />
                </div>
              )}
            </div>
          </div>
          
          {/* Generate Button */}
          <div className="generate-section">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || (selectedImages.length > 0 && selectedImages.length < 2)}
              className="generate-generate"
            >
              {loading ? "生成中..." : "生成圖像"}
            </button>
            
            {loading && (
              <div className="generate-loading" style={{ marginTop: "12px" }}>
                <div className="generate-spinner"></div>
                <p>正在生成圖像...</p>
              </div>
            )}
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="generate-error">
              {error}
            </div>
          )}
        </div>
        
        {/* Result Display */}
        <div className="generate-right">
          <h3>結果</h3>
          {loading && (
            <div className="generate-loading">
              <div className="generate-spinner"></div>
              <p>正在生成圖像...</p>
            </div>
          )}
          {result && (
            <div className="generate-result">
              <img src={result.imageUrl} alt="Generated Image" />
              <div className="generate-result-info">
                <p>檔名: {result.output_image_path?.split("/").pop() || "未知"}</p>
                {result.width && result.height && (
                  <p>尺寸: {result.width} × {result.height}</p>
                )}
                {result.output_format && (
                  <p>格式: {result.output_format}</p>
                )}
                {result.model_name && (
                  <p>模型: {result.model_name}</p>
                )}
                {result.parents && result.parents.length > 0 && (
                  <p>親代圖: {result.parents.join(", ")}</p>
                )}
              </div>
            </div>
          )}
          {!loading && !result && (
            <div className="generate-placeholder">
              <p>生成結果將顯示在這裡</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
