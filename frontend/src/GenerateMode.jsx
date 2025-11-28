import React, { useState, useEffect } from "react";
import "./GenerateMode.css";
import GenerateParamsForm from "./components/generate/GenerateParamsForm.jsx";
import GenerateResultsList from "./components/generate/GenerateResultsList.jsx";
import GenerateSearchInput from "./components/generate/GenerateSearchInput.jsx";
import useGenerateParams from "./hooks/useGenerateParams.js";
import useGenerateSearch from "./hooks/useGenerateSearch.js";
import { generateMixTwo, listOffspringImages } from "./api.js";
import CollageVersionMode from "./CollageVersionMode.jsx";
import {
  buildImageUrl,
  extractImageIdentifier,
  IMAGES_BASE,
  resolveImageUrl,
} from "./utils/generate.js";

function GenerateModeContent({ canGenerate, appMode, forbidMessage }) {
  const generationDisabled = !canGenerate;
  const blockedMessage = forbidMessage || `目前 APP_MODE=${appMode || "未知"} 禁止生成`;
  const [availableImages, setAvailableImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingImages, setLoadingImages] = useState(true);
  const [error, setError] = useState(generationDisabled ? blockedMessage : null);
  const [result, setResult] = useState(null);

  const {
    prompt,
    setPrompt,
    strength,
    setStrength,
    outputFormat,
    setOutputFormat,
    outputWidth,
    setOutputWidth,
    outputHeight,
    setOutputHeight,
    outputMaxSide,
    setOutputMaxSide,
    resizeMode,
    setResizeMode,
    count,
    setCount,
    buildParams,
  } = useGenerateParams();

  const {
    textQuery,
    setTextQuery,
    searchResults,
    searching,
    displayMode,
    setDisplayMode,
    handleTextSearch,
    handleSearchClear,
    handleKeyPress,
  } = useGenerateSearch({ imagesBase: IMAGES_BASE, onError: setError, availableImages });

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
    if (generationDisabled) {
      setError(blockedMessage);
    } else if (error === blockedMessage) {
      setError(null);
    }
  }, [blockedMessage, generationDisabled, error]);

  const handleImageToggle = (imageName) => {
    setSelectedImages((prev) => {
      if (prev.includes(imageName)) {
        return prev.filter((name) => name !== imageName);
      }
      return [...prev, imageName];
    });
    setError(null);
  };

  const displayImages = displayMode === "search" ? searchResults : availableImages;

  const handleGenerate = async () => {
    if (generationDisabled) {
      setError(blockedMessage);
      return;
    }
    if (selectedImages.length < 2 && selectedImages.length > 0) {
      setError("至少需要選擇 2 張圖片，或留空使用隨機抽樣");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = buildParams(selectedImages);

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
        <div className="generate-column generate-params-pane">
          <h2>圖像生成</h2>

          <div className="generate-section">
            <h3>參數設定</h3>
            <GenerateParamsForm
              prompt={prompt}
              onPromptChange={setPrompt}
              strength={strength}
              onStrengthChange={setStrength}
              outputFormat={outputFormat}
              onOutputFormatChange={setOutputFormat}
              outputWidth={outputWidth}
              onOutputWidthChange={setOutputWidth}
              outputHeight={outputHeight}
              onOutputHeightChange={setOutputHeight}
              outputMaxSide={outputMaxSide}
              onOutputMaxSideChange={setOutputMaxSide}
              resizeMode={resizeMode}
              onResizeModeChange={setResizeMode}
              selectedImagesCount={selectedImages.length}
              count={count}
              onCountChange={setCount}
            />
          </div>

          <div className="generate-section">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generationDisabled || loading || (selectedImages.length > 0 && selectedImages.length < 2)}
              className="generate-generate"
            >
              {loading ? "生成中..." : generationDisabled ? "生成已停用" : "生成圖像"}
            </button>

            {loading && (
              <div className="generate-loading" style={{ marginTop: "12px" }}>
                <div className="generate-spinner"></div>
                <p>正在生成圖像...</p>
              </div>
            )}
          </div>

          {error && <div className="generate-error">{error}</div>}
        </div>

        <div className="generate-column generate-image-pane">
          <div className="generate-section">
            <h3>圖片選擇（至少 2 張，或留空使用隨機抽樣）</h3>

            <GenerateSearchInput
              textQuery={textQuery}
              onTextQueryChange={setTextQuery}
              onTextSearch={handleTextSearch}
              onClear={handleSearchClear}
              searching={searching}
              onKeyPress={handleKeyPress}
            />

            <GenerateResultsList
              displayMode={displayMode}
              searchResultsLength={searchResults.length}
              onDisplayAll={() => setDisplayMode("all")}
              loadingImages={loadingImages}
              images={displayImages}
              selectedImages={selectedImages}
              onToggleImage={handleImageToggle}
              onClearSelection={() => setSelectedImages([])}
              resolveImageUrl={resolveImageUrl}
            />
          </div>
        </div>

        <div className="generate-column generate-result-pane">
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
                {result.width && result.height && <p>尺寸: {result.width} × {result.height}</p>}
                {result.output_format && <p>格式: {result.output_format}</p>}
                {result.model_name && <p>模型: {result.model_name}</p>}
                {result.parents && result.parents.length > 0 && <p>親代圖: {result.parents.join(", ")}</p>}
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

export default function GenerateMode({ canGenerate = true, appMode = "STUDIO", forbidMessage }) {
  const [activeTab, setActiveTab] = useState("collage");
  const [mountedTabs, setMountedTabs] = useState({ collage: true, generate: false });

  const switchTab = (tab) => {
    setActiveTab(tab);
    setMountedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
  };

  return (
    <div className="generate-tabs-shell">
      <div
        className="generate-tabbar"
        role="tablist"
        aria-label="生成/拼貼模式切換"
        data-ai-id="generate.tablist"
      >
        <button
          type="button"
          className={`generate-tab-button ${activeTab === "collage" ? "active" : ""}`}
          onClick={() => switchTab("collage")}
          role="tab"
          aria-selected={activeTab === "collage"}
          aria-controls="generate-tabpanel-collage"
          id="generate-tab-collage"
          data-ai-id="generate.tab.collage"
        >
          拼貼模式
        </button>
        <button
          type="button"
          className={`generate-tab-button ${activeTab === "generate" ? "active" : ""}`}
          onClick={() => switchTab("generate")}
          disabled={!canGenerate}
          role="tab"
          aria-selected={activeTab === "generate"}
          aria-controls="generate-tabpanel-generate"
          id="generate-tab-generate"
          aria-disabled={!canGenerate}
          data-ai-id="generate.tab.generate"
        >
          生成模式
        </button>
      </div>

      <div className="generate-tabpanels">
        {mountedTabs.collage && (
          <div
            className="generate-tabpanel"
            style={{ display: activeTab === "collage" ? "block" : "none" }}
            role="tabpanel"
            aria-hidden={activeTab !== "collage"}
            aria-labelledby="generate-tab-collage"
            id="generate-tabpanel-collage"
            data-ai-id="generate.tabpanel.collage"
          >
            <CollageVersionMode canGenerate={canGenerate} appMode={appMode} forbidMessage={forbidMessage} />
          </div>
        )}
        {mountedTabs.generate && (
          <div
            className="generate-tabpanel"
            style={{ display: activeTab === "generate" ? "block" : "none" }}
            role="tabpanel"
            aria-hidden={activeTab !== "generate"}
            aria-labelledby="generate-tab-generate"
            id="generate-tabpanel-generate"
            data-ai-id="generate.tabpanel.generate"
          >
            <GenerateModeContent canGenerate={canGenerate} appMode={appMode} forbidMessage={forbidMessage} />
          </div>
        )}
      </div>
    </div>
  );
}
