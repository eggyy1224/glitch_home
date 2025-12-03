import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createImageSearchRequest,
  createTextSearchRequest,
  listOffspringImages,
} from "../api";

export interface OffspringImageInfo {
  filename: string;
  url?: string;
}

type DisplayMode = "all" | "search";
type SearchResultPayload = { id: string };

interface UseCollageVersionImagesOptions {
  imagesBase: string;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useCollageVersionImages({ imagesBase, setError }: UseCollageVersionImagesOptions) {
  const [availableImages, setAvailableImages] = useState<OffspringImageInfo[]>([]);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [textQuery, setTextQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OffspringImageInfo[]>([]);
  const [searching, setSearching] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("all");
  const textSearchControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const loadImages = async () => {
      try {
        setLoadingImages(true);
        const data = await listOffspringImages();
        setAvailableImages(data.images || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`載入圖片列表失敗: ${message}`);
      } finally {
        setLoadingImages(false);
      }
    };
    loadImages();
  }, [setError]);

  useEffect(() => {
    return () => {
      if (textSearchControllerRef.current) {
        textSearchControllerRef.current.abort();
      }
    };
  }, []);

  const handleImageToggle = (imageName: string) => {
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

  const handleSearchResults = (resultList: SearchResultPayload[], emptyMessage: string) => {
    if (!resultList?.length) {
      setError(emptyMessage);
      setDisplayMode("all");
      return;
    }

    const convertedResults = resultList.map((result) => {
      const cleanId = result.id.replace(/:(en|zh)$/, "");
      return {
        filename: cleanId,
        url: `${imagesBase}${cleanId}`,
      };
    });
    setSearchResults(convertedResults);
    setDisplayMode("search");
  };

  const resolveImagePath = (query: string) => {
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

      const searchResultsData: { results?: SearchResultPayload[] } = await promise;
      textSearchControllerRef.current = null;

      const resultList = searchResultsData.results || [];
      handleSearchResults(resultList, `未找到與「${textQuery}」相關的圖像`);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "搜尋出錯";
      setError(message);
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void handleTextSearch();
    }
  };

  const displayImages = useMemo(() => (displayMode === "search" ? searchResults : availableImages), [displayMode, searchResults, availableImages]);

  const clearSelection = () => setSelectedImages([]);

  return {
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
  };
}
