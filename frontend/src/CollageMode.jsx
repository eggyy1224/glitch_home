import React from "react";
import "./CollageMode.css";
import { buildImageUrl } from "./utils/collageMath.js";
import {
  COLLAGE_MAX_COLS as MAX_COLS,
  COLLAGE_MAX_ROWS as MAX_ROWS,
  COLLAGE_PIECE_OVERLAP_PX as PIECE_OVERLAP_PX,
} from "./constants/collage.js";
import { useCollageControls } from "./hooks/useCollageControls.js";

export default function CollageMode(props) {
  const {
    rootRef,
    resizeHandleRef,
    stageClassName,
    controlsVisible,
    controlsEnabled,
    remoteSource,
    loading,
    error,
    imagePool,
    selectedImages,
    piecesByImage,
    imageMetrics,
    mixPieces,
    mixBoard,
    mixedPieces,
    edgesReady,
    edgeStatus,
    rows,
    cols,
    imageCount,
    totalPieces,
    stageWidth,
    finalStageHeight,
    handleImageCountChange,
    handleRowsChange,
    handleColsChange,
    toggleMixPieces,
    handleShuffle,
    handleResizePointerDown,
    imageCountMax,
  } = useCollageControls(props);

  const { imagesBase } = props;

  return (
    <div className="collage-root">
      {controlsVisible && (
        <div className="collage-panel">
          <div className="collage-controls">
            <div className="collage-control">
              <div className="collage-control-label">圖片數量</div>
              <div className="collage-control-inputs">
                <input
                  type="range"
                  min="1"
                  max={imageCountMax}
                  value={imageCount}
                  onChange={handleImageCountChange}
                  className="collage-slider"
                  disabled={!controlsEnabled || !imagePool.length}
                />
                <input
                  type="number"
                  min="1"
                  max={imageCountMax}
                  value={imageCount}
                  onChange={handleImageCountChange}
                  className="collage-number"
                  disabled={!controlsEnabled || !imagePool.length}
                />
              </div>
            </div>
            <div className="collage-control">
              <div className="collage-control-label">切片列數</div>
              <div className="collage-control-inputs">
                <input
                  type="range"
                  min="1"
                  max={MAX_ROWS}
                  value={rows}
                  onChange={handleRowsChange}
                  className="collage-slider"
                  disabled={!controlsEnabled}
                />
                <input
                  type="number"
                  min="1"
                  max={MAX_ROWS}
                  value={rows}
                  onChange={handleRowsChange}
                  className="collage-number"
                  disabled={!controlsEnabled}
                />
              </div>
            </div>
            <div className="collage-control">
              <div className="collage-control-label">切片行數</div>
              <div className="collage-control-inputs">
                <input
                  type="range"
                  min="1"
                  max={MAX_COLS}
                  value={cols}
                  onChange={handleColsChange}
                  className="collage-slider"
                  disabled={!controlsEnabled}
                />
                <input
                  type="number"
                  min="1"
                  max={MAX_COLS}
                  value={cols}
                  onChange={handleColsChange}
                  className="collage-number"
                  disabled={!controlsEnabled}
                />
              </div>
            </div>
            <label className="collage-toggle">
              <input type="checkbox" checked={mixPieces} onChange={toggleMixPieces} disabled={!controlsEnabled} />
              <span>混合拼貼</span>
            </label>
            <button type="button" className="collage-button" onClick={handleShuffle} disabled={!controlsEnabled}>
              重新打散
            </button>
          </div>
          <div className="collage-meta">
            {!controlsEnabled && (
              <span>遠端設定：{remoteSource === "client" ? "指定 client" : "全域"}</span>
            )}
            <span>可用圖像：{imagePool.length}</span>
            <span>每張切片：{rows * cols}</span>
            <span>總片數：{totalPieces}</span>
            <span>拼貼模式：{mixPieces ? "混合" : "分離"}</span>
            {mixPieces && (
              <span>
                混合盤面：{mixBoard.rows} × {mixBoard.cols}
              </span>
            )}
            {mixPieces && (
              <span>邊緣配對：{edgesReady && edgeStatus === "ready" ? "已啟用" : edgeStatus === "loading" ? "分析中" : "隨機"}</span>
            )}
            {mixPieces && (
              <span>
                畫布尺寸：{Math.round(stageWidth)} × {Math.round(finalStageHeight)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className={stageClassName} ref={rootRef}>
        {!loading && error && <div className="collage-status collage-status-error">{error}</div>}
        {!loading && selectedImages.length === 0 && !error && (
          <div className="collage-status">沒有圖像可顯示，請確認網址參數。</div>
        )}
        {!loading && !error && mixPieces && (
          <>
            <div
              className="collage-mix-surface"
              style={{
                width: `${stageWidth}px`,
                height: `${finalStageHeight}px`,
              }}
            >
              {mixedPieces.map((piece) => {
                const widthPercent = 100 / mixBoard.cols;
                const heightPercent = 100 / mixBoard.rows;
                const leftPercent = (piece.col / mixBoard.cols) * 100;
                const topPercent = (piece.row / mixBoard.rows) * 100;
                const backgroundX = cols <= 1 ? 50 : (piece.sourceCol / (cols - 1)) * 100;
                const backgroundY = rows <= 1 ? 50 : (piece.sourceRow / (rows - 1)) * 100;
                const imageUrl = buildImageUrl(imagesBase, piece.imageId);

                const style = {
                  width: `calc(${widthPercent}% + ${PIECE_OVERLAP_PX * 2}px)`,
                  height: `calc(${heightPercent}% + ${PIECE_OVERLAP_PX * 2}px)`,
                  left: `calc(${leftPercent}% - ${PIECE_OVERLAP_PX}px)`,
                  top: `calc(${topPercent}% - ${PIECE_OVERLAP_PX}px)`,
                  backgroundImage: `url("${imageUrl}")`,
                  backgroundSize: `${cols * 100}% ${rows * 100}%`,
                  backgroundPosition: `${backgroundX}% ${backgroundY}%`,
                  animationDelay: `${piece.delay.toFixed(2)}s`,
                  "--from-x": `${piece.fromX.toFixed(1)}px`,
                  "--from-y": `${piece.fromY.toFixed(1)}px`,
                  "--from-rot": `${piece.fromRot.toFixed(1)}deg`,
                };

                return <div key={piece.key} className="collage-piece collage-piece--mixed" style={style} />;
              })}
              {controlsEnabled && (
                <div
                  ref={resizeHandleRef}
                  className="collage-resize-handle"
                  onPointerDown={handleResizePointerDown}
                  role="presentation"
                />
              )}
            </div>
          </>
        )}

        {!loading && !error && !mixPieces &&
          selectedImages.map((imageId) => {
            const tilePieces = piecesByImage.get(imageId) || [];
            const imageUrl = buildImageUrl(imagesBase, imageId);
            const baseKey = imagesBase ?? "";
            const metric = imageMetrics[imageId];
            const tileRatio = metric && metric.base === baseKey ? metric.ratio : null;
            const tileStyle = tileRatio ? { aspectRatio: tileRatio } : undefined;
            return (
              <div key={imageId} className="collage-tile" style={tileStyle}>
                {tilePieces.map((piece) => {
                  const widthPercent = 100 / cols;
                  const heightPercent = 100 / rows;
                  const leftPercent = (piece.col / cols) * 100;
                  const topPercent = (piece.row / rows) * 100;
                  const backgroundX = cols <= 1 ? 50 : (piece.sourceCol / (cols - 1)) * 100;
                  const backgroundY = rows <= 1 ? 50 : (piece.sourceRow / (rows - 1)) * 100;

                  const style = {
                    width: `calc(${widthPercent}% + ${PIECE_OVERLAP_PX * 2}px)`,
                    height: `calc(${heightPercent}% + ${PIECE_OVERLAP_PX * 2}px)`,
                    left: `calc(${leftPercent}% - ${PIECE_OVERLAP_PX}px)`,
                    top: `calc(${topPercent}% - ${PIECE_OVERLAP_PX}px)`,
                    backgroundImage: `url("${imageUrl}")`,
                    backgroundSize: `${cols * 100}% ${rows * 100}%`,
                    backgroundPosition: `${backgroundX}% ${backgroundY}%`,
                    animationDelay: `${piece.delay.toFixed(2)}s`,
                    "--from-x": `${piece.fromX.toFixed(1)}px`,
                    "--from-y": `${piece.fromY.toFixed(1)}px`,
                    "--from-rot": `${piece.fromRot.toFixed(1)}deg`,
                  };

                  return <div key={piece.key} className="collage-piece" style={style} />;
                })}
                <div className="collage-label">{imageId}</div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
