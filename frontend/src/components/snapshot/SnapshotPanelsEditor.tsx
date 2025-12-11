import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createTextSearchRequest, listAncestorImages, listOffspringImages, listVideoAssets } from "../../api";
import { AssetDrawer } from "./AssetDrawer";
import { PanelCanvas } from "./PanelCanvas";
import { PanelList } from "./PanelList";
import { buildUrlFromPreset, getPanelModeAndAsset, mergePresetMode, MODE_PRESETS } from "./panelPresets";
import type { PanelMode } from "./panelPresets";
import { useSnapshotPanelDnd } from "./useSnapshotPanelDnd";
import type { AssetSearchMode, AssetTab, PanelConfig } from "./types";
import { buildVideoModeUrl } from "./videoPanelUtils";

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
      const relPath = typeof obj.relative_path === "string" ? obj.relative_path : "";
      const urlTail = typeof obj.url === "string" ? obj.url.split("/").pop() || "" : "";
      candidate =
        relPath ||
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

const FILTER_OFFSPRING_NAME = /^offspring/i;

const filterOffspringNamed = (list: string[]): string[] =>
  list.filter((name) => {
    const parts = name.split("/");
    const basename = parts[parts.length - 1] || name;
    return !FILTER_OFFSPRING_NAME.test(basename);
  });

const getImageBaseForTab = (tab: AssetTab): string => (tab === "ancestor_images" ? "/nightwalk_assets/" : "/generated_images/");

const normalizeImgBase = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
};

const extractImgBaseFromUrl = (url?: string | null): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    return parsed.searchParams.get("img_base");
  } catch (err) {
    return null;
  }
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
  const [offspringImageAssets, setOffspringImageAssets] = useState<string[]>([]);
  const [ancestorImageAssets, setAncestorImageAssets] = useState<string[]>([]);
  const [videoAssets, setVideoAssets] = useState<string[]>([]);
  const [assetStatus, setAssetStatus] = useState<string>("尚未載入資產");
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [assetTab, setAssetTab] = useState<AssetTab>("offspring_images");
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
      const [imgRes, ancestorRes, videoRes] = (await Promise.all([
        listOffspringImages(),
        listAncestorImages(),
        listVideoAssets(),
      ])) as Array<Record<string, unknown> | unknown>;
      const images = parseAssetList((imgRes as { images?: unknown })?.images ?? imgRes);
      const ancestorImagesRaw = parseAssetList((ancestorRes as { images?: unknown })?.images ?? ancestorRes);
      const ancestorImages = filterOffspringNamed(ancestorImagesRaw);
      const videos = parseAssetList((videoRes as { videos?: unknown })?.videos ?? videoRes);
      setOffspringImageAssets(images);
      setAncestorImageAssets(ancestorImages);
      setVideoAssets(videos);
      setAssetStatus(`後代 ${images.length} / 祖先 ${ancestorImages.length} / 影片 ${videos.length}`);
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
    if (assetTab !== "offspring_images" && assetSearchMode === "semantic") {
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
    if (assetTab !== "offspring_images") {
      setAssetSearchError(assetTab === "videos" ? "影片暫不支援語意搜尋，請改用名稱關鍵字" : "祖先圖像暫不支援語意搜尋");
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
    const allSource =
      assetTab === "videos" ? videoAssets : assetTab === "ancestor_images" ? ancestorImageAssets : offspringImageAssets;

    if (assetSearchMode === "semantic" && assetTab === "offspring_images") {
      const known = semanticResults.filter((name) => allSource.includes(name));
      const unknown = semanticResults.filter((name) => !allSource.includes(name));
      return [...known, ...unknown];
    }

    const source =
      assetTab === "videos" ? videoAssets : assetTab === "ancestor_images" ? ancestorImageAssets : offspringImageAssets;
    if (!keyword) return source;
    return source.filter((name) => name.toLowerCase().includes(keyword));
  }, [ancestorImageAssets, assetKeyword, assetSearchMode, assetTab, offspringImageAssets, semanticResults, videoAssets]);

  const assetPreviewUrl = (name: string, tab: AssetTab) => {
    if (!name) return "";
    if (tab === "videos") return "";
    if (name.startsWith("http")) return name;
    const base = getImageBaseForTab(tab);
    const encoded = name
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
    return `${base}${encoded}`;
  };

  const resolveImgBase = (tab: AssetTab, panel?: PanelConfig, override?: string | null) => {
    const explicit = normalizeImgBase(override);
    if (explicit) return explicit;
    const fromPanel = normalizeImgBase(extractImgBaseFromUrl(panel?.url));
    if (fromPanel) return fromPanel;
    if (tab === "ancestor_images") return getImageBaseForTab(tab);
    return null;
  };

  const handleModeSelect = (
    index: number,
    nextMode: PanelMode | "",
    currentAsset: string,
    panel?: PanelConfig,
    options?: { imgBase?: string | null },
  ) => {
    if (!nextMode) {
      onPanelChange(index, { url: "", image: "", params: mergePresetMode(panel?.params, "") });
      return;
    }
    const preset = MODE_PRESETS[nextMode as PanelMode];
    const imgBase = resolveImgBase(assetTab, panel, options?.imgBase);
    const nextUrl =
      nextMode === "video_mode"
        ? buildVideoModeUrl(panel?.url, { video: currentAsset })
        : preset
        ? buildUrlFromPreset(nextMode as PanelMode, currentAsset, { imgBase })
        : "";
    const patch: Partial<PanelConfig> = { url: nextUrl, params: mergePresetMode(panel?.params, nextMode) };
    if (preset?.assetKey === "img") {
      patch.image = currentAsset || panel?.image || "";
    }
    onPanelChange(index, patch);
  };

  const handleAssetChange = (
    index: number,
    mode: PanelMode | "",
    assetValue: string,
    panel?: PanelConfig,
    options?: { imgBase?: string | null },
  ) => {
    const preset = mode ? MODE_PRESETS[mode as PanelMode] : undefined;
    const isImageMode = preset?.assetKey === "img";
    const hasModePreset = Boolean(preset);
    const imgBase = resolveImgBase(assetTab, panel, options?.imgBase);
    if (hasModePreset) {
      const nextUrl =
        mode === "video_mode"
          ? buildVideoModeUrl(panel?.url, { video: assetValue })
          : preset
          ? buildUrlFromPreset(mode as PanelMode, assetValue, { imgBase })
          : "";
      const patch: Partial<PanelConfig> = { url: nextUrl, params: mergePresetMode(panel?.params, mode) };
      if (isImageMode) {
        patch.image = assetValue || "";
      }
      onPanelChange(index, patch);
      return;
    }

    const fallbackUrl = assetValue ? buildUrlFromPreset("static_mode", assetValue, { imgBase }) : panel?.url || "";
    onPanelChange(index, { url: fallbackUrl, image: assetValue || "" });
  };

  const handleImageChange = (
    index: number,
    value: string,
    panel?: PanelConfig,
    modeOverride?: PanelMode | "",
    imgBaseOverride?: string | null,
  ) => {
    const { mode } = getPanelModeAndAsset(panel);
    const resolvedMode = modeOverride || mode;
    const preset = resolvedMode ? MODE_PRESETS[resolvedMode as PanelMode] : undefined;
    const isImageMode = preset?.assetKey === "img";
    const resolvedUrlMode = isImageMode ? resolvedMode : value ? "static_mode" : null;
    const patch: Partial<PanelConfig> = { image: value || "" };
    const imgBase = resolveImgBase(assetTab, panel, imgBaseOverride);
    if (resolvedMode) {
      patch.params = mergePresetMode(panel?.params, resolvedMode);
    }
    if (resolvedUrlMode) {
      patch.url = buildUrlFromPreset(resolvedUrlMode as PanelMode, value, { imgBase });
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
    const imgBase =
      forceVideo || assetTab === "videos"
        ? null
        : resolveImgBase(assetTab, panel, assetTab === "ancestor_images" ? getImageBaseForTab(assetTab) : null);
    const nextMode =
      forceVideo && currentAssetKey === "video"
        ? mode || "video_mode"
        : !forceVideo && currentAssetKey === "img"
        ? mode || "static_mode"
        : forceVideo
        ? "video_mode"
        : "static_mode";
    handleModeSelect(index, nextMode as PanelMode, asset, panel, { imgBase });
    if (!forceVideo) {
      handleImageChange(index, asset, panel, nextMode as PanelMode, imgBase);
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
        imageAssets={offspringImageAssets}
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
