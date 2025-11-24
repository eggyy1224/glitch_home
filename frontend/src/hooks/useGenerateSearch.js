import { useCallback, useEffect, useRef, useState } from "react";
import { createImageSearchRequest, createTextSearchRequest } from "../api.js";
import { buildImageUrl, IMAGES_BASE } from "../utils/generate.js";

const buildSearchResult = (result, base) => {
  const cleanId = result.id.replace(/:(en|zh)$/i, "");
  return {
    filename: cleanId,
    url: buildImageUrl(base, cleanId),
  };
};

export default function useGenerateSearch({ imagesBase = IMAGES_BASE, onError, availableImages = [] } = {}) {
  const [textQuery, setTextQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [displayMode, setDisplayMode] = useState("all");
  const textSearchControllerRef = useRef(null);

  const notifyError = useCallback(
    (message) => {
      if (onError) {
        onError(message);
      }
    },
    [onError]
  );

  const abortTextSearch = useCallback(() => {
    if (textSearchControllerRef.current) {
      textSearchControllerRef.current.abort();
      textSearchControllerRef.current = null;
    }
  }, []);

  const handleSearchResults = useCallback(
    (resultList, emptyMessage) => {
      if (!resultList?.length) {
        setSearchResults([]);
        notifyError(emptyMessage);
        setDisplayMode("all");
        return;
      }

      const convertedResults = resultList.map((result) => buildSearchResult(result, imagesBase));
      setSearchResults(convertedResults);
      setDisplayMode("search");
      notifyError(null);
    },
    [imagesBase, notifyError]
  );

  useEffect(() => {
    return () => {
      abortTextSearch();
    };
  }, [abortTextSearch]);

  const resolveImagePath = useCallback(
    (query) => {
      const trimmed = query.trim();
      if (!trimmed) return null;
      const lower = trimmed.toLowerCase();
      const exact = availableImages.find((img) => img.filename.toLowerCase() === lower);
      if (exact) return exact.filename;
      const partial = availableImages.find((img) => img.filename.toLowerCase().includes(lower));
      return partial?.filename ?? null;
    },
    [availableImages]
  );

  const handleTextSearch = useCallback(async () => {
    const query = textQuery.trim();
    if (!query) {
      notifyError("請輸入圖片名稱或關鍵字");
      return;
    }

    const imageName = resolveImagePath(query);

    abortTextSearch();

    setSearching(true);
    notifyError(null);

    try {
      const { controller, promise } = imageName
        ? createImageSearchRequest(buildImageUrl(imagesBase, imageName), 50)
        : createTextSearchRequest(query, 50);
      textSearchControllerRef.current = controller;

      const searchResultsData = await promise;
      textSearchControllerRef.current = null;

      const resultList = searchResultsData.results || [];
      handleSearchResults(resultList, `未找到與「${query}」相關的圖像`);
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      notifyError(err.message || "搜尋出錯");
    } finally {
      setSearching(false);
    }
  }, [abortTextSearch, handleSearchResults, notifyError, resolveImagePath, textQuery]);

  const handleSearchClear = useCallback(() => {
    abortTextSearch();
    setTextQuery("");
    setSearchResults([]);
    setDisplayMode("all");
    notifyError(null);
    setSearching(false);
  }, [abortTextSearch, notifyError]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === "Enter") {
      handleTextSearch();
    }
  }, [handleTextSearch]);

  return {
    textQuery,
    setTextQuery,
    searchResults,
    searching,
    displayMode,
    setDisplayMode,
    handleTextSearch,
    handleSearchClear,
    handleKeyPress,
  };
}
