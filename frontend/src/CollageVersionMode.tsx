import React, { useEffect, useMemo, useState } from "react";
import "./CollageVersionMode.css";
import { useCollageVersionImages } from "./hooks/useCollageVersionImages";
import { useCollageVersionGeneration } from "./hooks/useCollageVersionGeneration";
import { ParamsForm } from "./components/collageVersion/ParamsForm";
import { GenerateControls } from "./components/collageVersion/GenerateControls";
import { ImageSelector } from "./components/collageVersion/ImageSelector";
import { ResultPane } from "./components/collageVersion/ResultPane";

interface CollageVersionModeProps {
  canGenerate?: boolean;
  appMode?: string;
  forbidMessage?: string | undefined;
}

const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";
const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function CollageVersionMode({
  canGenerate = true,
  appMode = "STUDIO",
  forbidMessage,
}: CollageVersionModeProps) {
  const generationDisabled = !canGenerate;
  const blockedMessage = forbidMessage || `目前 APP_MODE=${appMode || "未知"} 禁止生成`;
  const [error, setError] = useState<string | null>(generationDisabled ? blockedMessage : null);
  
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

  const minRequired = useMemo(() => (mode === "rotate-90" ? 1 : 2), [mode]);

  const {
    selectedImages,
    loadingImages,
    textQuery,
    setTextQuery,
    searchResults,
    searching,
    displayMode,
    displayImages,
    handleImageToggle,
    handleTextSearch,
    handleSearchClear,
    handleKeyPress,
    setDisplayMode,
    clearSelection,
  } = useCollageVersionImages({ imagesBase: IMAGES_BASE, setError });

  const { loading, result, progress, progressStage, progressMessage, handleGenerate } = useCollageVersionGeneration({
    apiBase: API_BASE,
    selectedImages,
    minRequired,
    generationDisabled,
    blockedMessage,
    params: {
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
    },
    setError,
  });

  useEffect(() => {
    if (generationDisabled) {
      setError(blockedMessage);
    } else if (error === blockedMessage) {
      setError(null);
    }
  }, [blockedMessage, generationDisabled, error]);

  return (
    <div className="collage-version-mode">
      <div className="collage-version-container">
        <div className="collage-version-column collage-version-params-pane">
          <h2>拼貼生成</h2>

          <ParamsForm
            rows={rows}
            cols={cols}
            mode={mode}
            seed={seed}
            resizeW={resizeW}
            padPx={padPx}
            jitterPx={jitterPx}
            rotateDeg={rotateDeg}
            format={format}
            quality={quality}
            setRows={setRows}
            setCols={setCols}
            setMode={setMode}
            setSeed={setSeed}
            setResizeW={setResizeW}
            setPadPx={setPadPx}
            setJitterPx={setJitterPx}
            setRotateDeg={setRotateDeg}
            setFormat={setFormat}
            setQuality={setQuality}
          />

          <GenerateControls
            loading={loading}
            generationDisabled={generationDisabled}
            selectedCount={selectedImages.length}
            minRequired={minRequired}
            progress={progress}
            progressStage={progressStage}
            progressMessage={progressMessage}
            onGenerate={handleGenerate}
          />

          {error && <div className="collage-version-error">{error}</div>}
        </div>

        <div className="collage-version-column collage-version-image-pane">
          <ImageSelector
            minRequired={minRequired}
            textQuery={textQuery}
            setTextQuery={setTextQuery}
            searching={searching}
            displayMode={displayMode}
            searchResultsCount={searchResults.length}
            displayImages={displayImages}
            selectedImages={selectedImages}
            loadingImages={loadingImages}
            imagesBase={IMAGES_BASE}
            onSearch={handleTextSearch}
            onSearchClear={handleSearchClear}
            onKeyPress={handleKeyPress}
            onToggleDisplayMode={() => setDisplayMode("all")}
            onToggleImage={handleImageToggle}
            onClearSelection={clearSelection}
          />
        </div>

        <ResultPane loading={loading} result={result} />
      </div>
    </div>
  );
}
