import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTextSearchRequest, listOffspringImages, listVideoAssets } from "../../api";
import { AssetDrawer } from "./AssetDrawer";
import { PanelCanvas } from "./PanelCanvas";
import { PanelList } from "./PanelList";
import { buildUrlFromPreset, getPanelModeAndAsset, mergePresetMode, MODE_PRESETS } from "./panelPresets";
import type { PanelMode } from "./panelPresets";
import { useSnapshotPanelDnd } from "./useSnapshotPanelDnd";
import type { AssetSearchMode, AssetTab, PanelConfig } from "./types";

interface SnapshotPanelsEditorProps {
  panels: PanelConfig[];
  selectedRows: number[];
  onToggleRow: (index: number) => void;
  onMoveRow: (index: number, delta: number) => void;
  onDuplicateRow: (index: number) => void;
  onRemoveRow: (index: number) => void;
  onAddPanel: () => void;
  onCopy: () => void;
  onPaste: () => void;
  canPaste: boolean;
  onPanelChange: (index: number, patch: Partial<PanelConfig>) => void;
  layoutColumns?: number;
  layoutGap?: number;
  onSelectPanel?: (index: number) => void;
}

const parseAssetList = (rawList: unknown): string[] => {
  const list = Array.isArray(rawList) ? rawList : [];
  const seen = new Set<string>();
  const names: string[] = [];
  list.forEach((item: unknown) => {
    let candidate = "";
    if (typeof item === "string") {
      candidate = item;
    } else if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const urlTail = typeof obj.url === "string" ? obj.url.split("/").pop() || "" : "";
      candidate =
        (typeof obj.name === "string" && obj.name) ||
        (typeof obj.basename === "string" && obj.basename) ||
        (typeof obj.filename === "string" && obj.filename) ||
        urlTail;
    }
    if (candidate && !seen.has(candidate)) {
      seen.add(candidate);
      names.push(candidate);
    }
  });
  return names;
};

export default function SnapshotPanelsEditor({
  panels,
  selectedRows,
  onToggleRow,
  onMoveRow,
  onDuplicateRow,
  onRemoveRow,
  onAddPanel,
  onCopy,
  onPaste,
  canPaste,
  onPanelChange,
  layoutColumns = 1,
  layoutGap = 0,
  onSelectPanel,
}: SnapshotPanelsEditorProps) {
  const [imageAssets, setImageAssets] = useState<string[]>([]);
  const [videoAssets, setVideoAssets] = useState<string[]>([]);
  const [assetStatus, setAssetStatus] = useState<string>("尚未載入資產");
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetTab, setAssetTab] = useState<AssetTab>("images");
  const [assetKeyword, setAssetKeyword] = useState<string>("");
  const [assetDrawerOpen, setAssetDrawerOpen] = useState(true);
  const [assetDrawerHeight, setAssetDrawerHeight] = useState<number>(260);
  const [assetSearchMode, setAssetSearchMode] = useState<AssetSearchMode>("name"); // name | semantic
  const [semanticResults, setSemanticResults] = useState<string[]>([]);
  const [searchingSemantic, setSearchingSemantic] = useState(false);
  const [assetSearchError, setAssetSearchError] = useState<string | null>(null);
  const semanticSearchControllerRef = useRef<AbortController | null>(null);

  const loadAssets = useCallback(async () => {
    try {
      setLoadingAssets(true);
      setAssetStatus("載入資產中...");
      const [imgRes, videoRes] = (await Promise.all([listOffspringImages(), listVideoAssets()])) as Array<Record<string, unknown> | unknown>;
      const images = parseAssetList((imgRes as { images?: unknown })?.images ?? imgRes);
      const videos = parseAssetList((videoRes as { videos?: unknown })?.videos ?? videoRes);
      setImageAssets(images);
      setVideoAssets(videos);
      setAssetStatus(`圖片 ${images.length} / 影片 ${videos.length}`);
    } catch (err) {
      const message = (err as Error)?.message || "載入資產失敗";
      setAssetStatus(message);
    } finally {
      setLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    return () => {
      if (semanticSearchControllerRef.current) {
        semanticSearchControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (assetTab === "videos" && assetSearchMode === "semantic") {
      setAssetSearchMode("name");
      setSemanticResults([]);
      setAssetSearchError(null);
    }
  }, [assetTab, assetSearchMode]);

  const clampAssetDrawerHeight = useCallback((height: number) => {
    const min = 160;
    const max = typeof window !== "undefined" ? Math.max(320, window.innerHeight - 200) : 900;
    return Math.min(Math.max(height, min), max);
  }, []);

  const startAssetDrawerResize = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = assetDrawerHeight;
      const onMove = (e: MouseEvent) => {
        const delta = e.clientY - startY;
        setAssetDrawerHeight(clampAssetDrawerHeight(startHeight + delta));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [assetDrawerHeight, clampAssetDrawerHeight],
  );

  const runSemanticSearch = useCallback(async () => {
    const query = assetKeyword.trim();
    if (!query) {
      setAssetSearchError("請先輸入搜尋詞");
      return;
    }
    if (assetTab === "videos") {
      setAssetSearchError("影片暫不支援語意搜尋，請改用名稱關鍵字");
      return;
    }
    if (semanticSearchControllerRef.current) {
      semanticSearchControllerRef.current.abort();
    }
    setSearchingSemantic(true);
    setAssetSearchError(null);
    try {
      const { controller, promise } = createTextSearchRequest(query, 80);
      semanticSearchControllerRef.current = controller;
      const data = await promise;
      semanticSearchControllerRef.current = null;
      const results = Array.isArray(data?.results) ? data.results : [];
      const names = results
        .map((item) => {
          const id = typeof item === "string" ? item : item?.id || item?.name || item?.filename || item?.img;
          if (!id) return "";
          return String(id)
            .replace(/^backend\/offspring_images\//, "")
            .replace(/:(en|zh)$/i, "");
        })
        .filter(Boolean);
      setSemanticResults(names);
      setAssetSearchMode("semantic");
      if (!names.length) {
        setAssetSearchError(`未找到與「${query}」相關的圖像`);
      }
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      setAssetSearchError((err as Error)?.message || "搜尋失敗");
    } finally {
      setSearchingSemantic(false);
    }
  }, [assetKeyword, assetTab]);

  const clearSemanticSearch = useCallback(() => {
    if (semanticSearchControllerRef.current) {
      semanticSearchControllerRef.current.abort();
      semanticSearchControllerRef.current = null;
    }
    setSemanticResults([]);
    setAssetSearchMode("name");
    setAssetSearchError(null);
  }, []);

  const filteredAssets = useMemo(() => {
    const keyword = assetKeyword.trim().toLowerCase();
    const allSource = assetTab === "videos" ? videoAssets : imageAssets;

    if (assetSearchMode === "semantic" && assetTab === "images") {
      const known = semanticResults.filter((name) => allSource.includes(name));
      const unknown = semanticResults.filter((name) => !allSource.includes(name));
      return [...known, ...unknown];
    }

    const source = assetTab === "videos" ? videoAssets : imageAssets;
    if (!keyword) return source;
    return source.filter((name) => name.toLowerCase().includes(keyword));
  }, [assetKeyword, assetSearchMode, assetTab, imageAssets, semanticResults, videoAssets]);

  const assetPreviewUrl = (name: string, tab: AssetTab) => {
    if (!name) return "";
    if (tab === "videos") return "";
    if (name.startsWith("http")) return name;
    return `/generated_images/${name}`;
  };

  const handleModeSelect = (index: number, nextMode: PanelMode | "", currentAsset: string, panel?: PanelConfig) => {
    if (!nextMode) {
      onPanelChange(index, { url: "", image: "", params: mergePresetMode(panel?.params, "") });
      return;
    }
    const preset = MODE_PRESETS[nextMode as PanelMode];
    const nextUrl = preset ? buildUrlFromPreset(nextMode as PanelMode, currentAsset) : "";
    const patch: Partial<PanelConfig> = { url: nextUrl, params: mergePresetMode(panel?.params, nextMode) };
    if (preset?.assetKey === "img") {
      patch.image = currentAsset || panel?.image || "";
    }
    onPanelChange(index, patch);
  };

  const handleAssetChange = (index: number, mode: PanelMode | "", assetValue: string, panel?: PanelConfig) => {
    const preset = mode ? MODE_PRESETS[mode as PanelMode] : undefined;
    const isImageMode = preset?.assetKey === "img";
    const hasModePreset = Boolean(preset);
    if (hasModePreset) {
      const nextUrl = preset ? buildUrlFromPreset(mode as PanelMode, assetValue) : "";
      const patch: Partial<PanelConfig> = { url: nextUrl, params: mergePresetMode(panel?.params, mode) };
      if (isImageMode) {
        patch.image = assetValue || "";
      }
      onPanelChange(index, patch);
      return;
    }

    const fallbackUrl = assetValue ? buildUrlFromPreset("static_mode", assetValue) : panel?.url || "";
    onPanelChange(index, { url: fallbackUrl, image: assetValue || "" });
  };

  const handleImageChange = (index: number, value: string, panel?: PanelConfig) => {
    const { mode } = getPanelModeAndAsset(panel);
    const preset = mode ? MODE_PRESETS[mode as PanelMode] : undefined;
    const isImageMode = preset?.assetKey === "img";
    const resolvedMode = isImageMode ? mode : value ? "static_mode" : null;
    const patch: Partial<PanelConfig> = { image: value || "", params: mergePresetMode(panel?.params, mode) };
    if (resolvedMode) {
      patch.url = buildUrlFromPreset(resolvedMode as PanelMode, value);
    }
    onPanelChange(index, patch);
  };

  function applyAssetToPanel(index: number, asset: string, assetTypeHint?: "video" | "image") {
    if (!asset || index == null || index < 0) return;
    const panel = panels?.[index];
    const assetType = assetTypeHint || (assetTab === "videos" ? "video" : "image");
    const { mode } = getPanelModeAndAsset(panel);
    const preset = mode ? MODE_PRESETS[mode as PanelMode] : undefined;
    const currentAssetKey = preset?.assetKey;
    const forceVideo = assetType === "video";
    const nextMode =
      forceVideo && currentAssetKey === "video"
        ? mode || "video_mode"
        : !forceVideo && currentAssetKey === "img"
        ? mode || "static_mode"
        : forceVideo
        ? "video_mode"
        : "static_mode";
    handleModeSelect(index, nextMode as PanelMode, asset, panel);
    if (!forceVideo) {
      handleImageChange(index, asset, panel);
    }
    if (typeof onSelectPanel === "function") {
      onSelectPanel(index);
    }
  }

  const handleAssetApply = (asset: string) => {
    if (!asset || !selectedRows.length) return;
    applyAssetToPanel(selectedRows[0], asset, assetTab === "videos" ? "video" : "image");
  };

  const { handlePanelDrag, handlePanelDrop } = useSnapshotPanelDnd({
    panels,
    onMoveRow,
    applyAssetToPanel,
    onSelectPanel,
  });

  return (
    <div data-ai-section="snapshot.panels">
      <PanelCanvas
        panels={panels}
        selectedRows={selectedRows}
        layoutColumns={layoutColumns}
        layoutGap={layoutGap}
        handlePanelDrag={handlePanelDrag}
        handlePanelDrop={handlePanelDrop}
        onPanelChange={onPanelChange}
        onSelectPanel={onSelectPanel}
        onToggleRow={onToggleRow}
      />

      <AssetDrawer
        open={assetDrawerOpen}
        assetTab={assetTab}
        assetKeyword={assetKeyword}
        assetDrawerHeight={assetDrawerHeight}
        assetStatus={assetStatus}
        assetSearchMode={assetSearchMode}
        semanticResults={semanticResults}
        assetSearchError={assetSearchError}
        searchingSemantic={searchingSemantic}
        loadingAssets={loadingAssets}
        filteredAssets={filteredAssets}
        selectedRows={selectedRows}
        onToggle={() => setAssetDrawerOpen((prev) => !prev)}
        onTabChange={setAssetTab}
        onKeywordChange={setAssetKeyword}
        onSearch={runSemanticSearch}
        onClearSearch={clearSemanticSearch}
        onReload={loadAssets}
        onApplyAsset={handleAssetApply}
        onResizeStart={startAssetDrawerResize}
        assetPreviewUrl={assetPreviewUrl}
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, flexWrap: "wrap" }}>
        <button type="button" onClick={onAddPanel} data-ai-action="snapshot.panel.add">
          新增 panel
        </button>
        <button type="button" onClick={onCopy} disabled={!selectedRows.length} data-ai-action="snapshot.panel.copy">
          複製選取
        </button>
        <button type="button" onClick={onPaste} disabled={!canPaste} data-ai-action="snapshot.panel.paste">
          貼上
        </button>
        <span style={{ color: "#82dca5" }}>至少填 url 或 image</span>
        <span
          style={{ color: "#82dca5" }}
          role="status"
          aria-live="polite"
          id="snapshot.assets.status"
          data-ai-id="snapshot.assets.status"
        >
          資產：{assetStatus}
        </span>
        <button type="button" onClick={loadAssets} disabled={loadingAssets} data-ai-action="snapshot.panel.assets.reload">
          重新載入資產
        </button>
      </div>

      <PanelList
        panels={panels}
        selectedRows={selectedRows}
        videoAssets={videoAssets}
        imageAssets={imageAssets}
        onPanelChange={onPanelChange}
        onModeSelect={handleModeSelect}
        onAssetChange={handleAssetChange}
        onImageChange={handleImageChange}
        onToggleRow={onToggleRow}
        onMoveRow={onMoveRow}
        onDuplicateRow={onDuplicateRow}
        onRemoveRow={onRemoveRow}
        onSelectPanel={onSelectPanel}
      />
    </div>
  );
}
