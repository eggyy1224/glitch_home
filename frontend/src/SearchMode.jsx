import React, { useState, useRef } from "react";
import { searchImagesByImage, searchImagesByText } from "./api.js";

const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";

export default function SearchMode({ imagesBase = IMAGES_BASE }) {
  // 搜尋模式切換
  const [searchType, setSearchType] = useState("image"); // "image" or "text"
  
  // 圖片搜尋相關
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  // 文字搜尋相關
  const [textQuery, setTextQuery] = useState("");

  // 共通狀態
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  // ============ 圖片搜尋 ============
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError(null);
    setResults([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleImageSearch = async () => {
    if (!selectedFile) {
      setError("請先選擇圖片");
      return;
    }

    setSearching(true);
    setError(null);
    setResults([]);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const apiBase = import.meta.env.VITE_API_BASE || "";
      const uploadUrl = `${apiBase}/api/screenshots`;

      console.log("上傳圖片到:", uploadUrl);

      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(`圖片上傳失敗 (${uploadRes.status}): ${errorText}`);
      }

      const uploadData = await uploadRes.json();
      console.log("上傳結果:", uploadData);

      const uploadedPath = uploadData.absolute_path || uploadData.relative_path;

      if (!uploadedPath) {
        throw new Error("上傳成功但無法取得檔案路徑");
      }

      console.log("使用路徑搜尋:", uploadedPath);

      const searchResults = await searchImagesByImage(uploadedPath, 15);
      console.log("搜尋結果:", searchResults);

      const resultList = searchResults.results || [];
      if (resultList.length === 0) {
        setError("搜尋完成，但沒有找到相似的圖像");
      } else {
        setResults(resultList);
      }
    } catch (err) {
      console.error("搜尋出錯:", err);
      setError(err.message || "搜尋出錯，請檢查瀏覽器控制台");
    } finally {
      setSearching(false);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreview(null);
    setResults([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ============ 文字搜尋 ============
  const handleTextSearch = async () => {
    if (!textQuery.trim()) {
      setError("請輸入搜尋詞");
      return;
    }

    setSearching(true);
    setError(null);
    setResults([]);

    try {
      console.log("搜尋文字:", textQuery);
      const searchResults = await searchImagesByText(textQuery, 15);
      console.log("搜尋結果:", searchResults);

      const resultList = searchResults.results || [];
      if (resultList.length === 0) {
        setError(`未找到與「${textQuery}」相關的圖像`);
      } else {
        setResults(resultList);
      }
    } catch (err) {
      console.error("搜尋出錯:", err);
      setError(err.message || "搜尋出錯");
    } finally {
      setSearching(false);
    }
  };

  const handleTextClear = () => {
    setTextQuery("");
    setResults([]);
    setError(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleTextSearch();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>🔍 相似度搜尋</h1>
        <p>以圖片或文字搜尋相似的後代影像</p>
      </div>

      {/* 搜尋模式切換 */}
      <div style={styles.modeSelector}>
        <button
          onClick={() => setSearchType("image")}
          style={{
            ...styles.modeButton,
            ...(searchType === "image" ? styles.modeButtonActive : styles.modeButtonInactive),
          }}
        >
          📸 以圖搜圖
        </button>
        <button
          onClick={() => setSearchType("text")}
          style={{
            ...styles.modeButton,
            ...(searchType === "text" ? styles.modeButtonActive : styles.modeButtonInactive),
          }}
        >
          📝 文字搜尋
        </button>
      </div>

      {/* 圖片搜尋界面 */}
      {searchType === "image" && (
        <div style={styles.searchSection}>
          <div style={styles.uploadArea}>
            {preview ? (
              <div style={styles.previewContainer}>
                <img src={preview} alt="預覽" style={styles.previewImage} />
                <p style={styles.fileName}>{selectedFile.name}</p>
              </div>
            ) : (
              <div
                style={styles.uploadPrompt}
                onClick={() => fileInputRef.current?.click()}
              >
                <div style={styles.uploadIcon}>📸</div>
                <p>點擊上傳圖片或拖放</p>
                <p style={{ fontSize: "12px", opacity: 0.6 }}>支援 PNG, JPG, JPEG</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
          </div>

          <div style={styles.controls}>
            <button
              onClick={handleImageSearch}
              disabled={!selectedFile || searching}
              style={{
                ...styles.button,
                ...((!selectedFile || searching) ? styles.buttonDisabled : styles.buttonPrimary),
              }}
            >
              {searching ? "🔄 搜尋中..." : "🚀 搜尋"}
            </button>
            {selectedFile && (
              <button
                onClick={handleClear}
                disabled={searching}
                style={{ ...styles.button, ...styles.buttonSecondary }}
              >
                清除
              </button>
            )}
          </div>
        </div>
      )}

      {/* 文字搜尋界面 */}
      {searchType === "text" && (
        <div style={styles.searchSection}>
          <div style={styles.textSearchArea}>
            <input
              type="text"
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="輸入搜尋詞... 例如：白馬、夜晚、人物"
              style={styles.textInput}
            />
            <div style={styles.controls}>
              <button
                onClick={handleTextSearch}
                disabled={!textQuery.trim() || searching}
                style={{
                  ...styles.button,
                  ...(!textQuery.trim() || searching ? styles.buttonDisabled : styles.buttonPrimary),
                }}
              >
                {searching ? "🔄 搜尋中..." : "🚀 搜尋"}
              </button>
              {textQuery && (
                <button
                  onClick={handleTextClear}
                  disabled={searching}
                  style={{ ...styles.button, ...styles.buttonSecondary }}
                >
                  清除
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {results.length > 0 && (
        <div style={styles.resultsSection}>
          <h2>搜尋結果（{results.length} 張）</h2>
          <div style={styles.resultsGrid}>
            {results.map((result, i) => {
              const cleanId = result.id.replace(/:(en|zh)$/, "");
              const imageUrl = `${imagesBase}${cleanId}`;

              return (
                <div key={i} style={styles.resultCard}>
                  <div style={styles.resultImageContainer}>
                    <img
                      src={imageUrl}
                      alt={cleanId}
                      style={styles.resultImage}
                      onError={(e) => {
                        e.target.style.backgroundColor = "#e8e8e8";
                      }}
                    />
                    <div style={styles.distanceBadge}>
                      距離: {result.distance?.toFixed(3)}
                    </div>
                  </div>
                  <div style={styles.resultInfo}>
                    <p style={styles.resultTitle}>{cleanId}</p>
                    <p style={styles.resultMeta}>
                      相似度：{Math.max(0, ((1 - (result.distance || 0) / 2) * 100)).toFixed(0)}%
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    width: "100%",
    minHeight: "100vh",
    backgroundColor: "#f8f9fa",
    padding: "2rem",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: {
    textAlign: "center",
    marginBottom: "2rem",
  },
  modeSelector: {
    display: "flex",
    justifyContent: "center",
    gap: "1rem",
    marginBottom: "2rem",
  },
  modeButton: {
    padding: "10px 20px",
    borderRadius: "6px",
    border: "2px solid #ddd",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  modeButtonActive: {
    backgroundColor: "#007bff",
    color: "white",
    borderColor: "#007bff",
  },
  modeButtonInactive: {
    backgroundColor: "white",
    color: "#333",
    borderColor: "#ddd",
  },
  searchSection: {
    maxWidth: "600px",
    margin: "0 auto 2rem",
  },
  uploadArea: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "2rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    marginBottom: "1rem",
  },
  textSearchArea: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "2rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    marginBottom: "1rem",
  },
  textInput: {
    width: "100%",
    padding: "12px",
    marginBottom: "1rem",
    borderRadius: "6px",
    border: "1px solid #ddd",
    fontSize: "14px",
    boxSizing: "border-box",
  },
  previewContainer: {
    textAlign: "center",
  },
  previewImage: {
    maxWidth: "100%",
    maxHeight: "300px",
    borderRadius: "8px",
    marginBottom: "1rem",
  },
  fileName: {
    fontSize: "14px",
    color: "#666",
    marginBottom: 0,
  },
  uploadPrompt: {
    cursor: "pointer",
    padding: "3rem 1rem",
    textAlign: "center",
    border: "2px dashed #ddd",
    borderRadius: "8px",
    transition: "all 0.3s ease",
  },
  uploadIcon: {
    fontSize: "48px",
    marginBottom: "1rem",
  },
  controls: {
    display: "flex",
    gap: "1rem",
    justifyContent: "center",
  },
  button: {
    padding: "10px 20px",
    borderRadius: "6px",
    border: "none",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  buttonPrimary: {
    backgroundColor: "#007bff",
    color: "white",
  },
  buttonSecondary: {
    backgroundColor: "#6c757d",
    color: "white",
  },
  buttonDisabled: {
    backgroundColor: "#ccc",
    color: "#999",
    cursor: "not-allowed",
  },
  error: {
    maxWidth: "600px",
    margin: "0 auto 2rem",
    padding: "1rem",
    backgroundColor: "#f8d7da",
    color: "#721c24",
    borderRadius: "6px",
    border: "1px solid #f5c6cb",
  },
  resultsSection: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  resultsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
    marginTop: "1rem",
  },
  resultCard: {
    backgroundColor: "white",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    transition: "transform 0.3s ease",
    cursor: "pointer",
  },
  resultImageContainer: {
    position: "relative",
    width: "100%",
    paddingBottom: "100%",
    overflow: "hidden",
  },
  resultImage: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  distanceBadge: {
    position: "absolute",
    top: "8px",
    right: "8px",
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "white",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "12px",
  },
  resultInfo: {
    padding: "1rem",
  },
  resultTitle: {
    margin: "0 0 0.5rem",
    fontSize: "13px",
    fontWeight: "500",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  resultMeta: {
    margin: 0,
    fontSize: "12px",
    color: "#666",
  },
};
