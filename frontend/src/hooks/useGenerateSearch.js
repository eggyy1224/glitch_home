import { useCallback, useEffect, useRef, useState } from "react";
import {
  createImageSearchRequest,
  createImageUploadRequest,
  createTextSearchRequest,
} from "../api.js";
import { buildImageUrl, IMAGES_BASE } from "../utils/generate.js";

const buildSearchResult = (result, base) => {
  const cleanId = result.id.replace(/:(en|zh)$/i, "");
  return {
    filename: cleanId,
    url: buildImageUrl(base, cleanId),
  };
};

export default function useGenerateSearch({ imagesBase = IMAGES_BASE, onError } = {}) {
  const [searchType, setSearchType] = useState("text");
  const [textQuery, setTextQuery] = useState("");
  const [searchFile, setSearchFile] = useState(null);
  const [searchPreview, setSearchPreview] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [displayMode, setDisplayMode] = useState("all");
  const fileInputRef = useRef(null);
  const uploadControllerRef = useRef(null);
  const imageSearchControllerRef = useRef(null);
  const textSearchControllerRef = useRef(null);

  const notifyError = useCallback(
    (message) => {
      if (onError) {
        onError(message);
      }
    },
    [onError]
  );

  const abortImageSearch = useCallback(() => {
    if (uploadControllerRef.current) {
      uploadControllerRef.current.abort();
      uploadControllerRef.current = null;
    }
    if (imageSearchControllerRef.current) {
      imageSearchControllerRef.current.abort();
      imageSearchControllerRef.current = null;
    }
  }, []);

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
      abortImageSearch();
      abortTextSearch();
    };
  }, [abortImageSearch, abortTextSearch]);

  const handleFileSelect = useCallback((file) => {
    if (!file) return;

    setSearchFile(file);
    notifyError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      setSearchPreview(event.target.result);
    };
    reader.readAsDataURL(file);
  }, [notifyError]);

  const handleImageSearch = useCallback(async () => {
    if (!searchFile) {
      notifyError("請先選擇圖片");
      return;
    }

    abortTextSearch();
    abortImageSearch();

    setSearching(true);
    notifyError(null);

    try {
      const { controller: uploadController, promise: uploadPromise } = createImageUploadRequest(searchFile);
      uploadControllerRef.current = uploadController;

      const { searchPath, fallbackPath } = await uploadPromise;
      uploadControllerRef.current = null;

      const runSearch = async (path) => {
        const { controller, promise } = createImageSearchRequest(path, 50);
        imageSearchControllerRef.current = controller;
        const searchResultsData = await promise;
        imageSearchControllerRef.current = null;
        return searchResultsData;
      };

      let searchResultsData;
      try {
        searchResultsData = await runSearch(searchPath);
      } catch (searchErr) {
        if (searchErr.name === "AbortError") {
          return;
        }
        if (fallbackPath && fallbackPath !== searchPath) {
          searchResultsData = await runSearch(fallbackPath);
        } else {
          throw searchErr;
        }
      }

      const resultList = searchResultsData?.results || [];
      handleSearchResults(resultList, "搜尋完成，但沒有找到相似的圖像");
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      notifyError(err.message || "搜尋出錯");
    } finally {
      setSearching(false);
    }
  }, [abortImageSearch, abortTextSearch, handleSearchResults, notifyError, searchFile]);

  const handleTextSearch = useCallback(async () => {
    const query = textQuery.trim();
    if (!query) {
      notifyError("請輸入搜尋詞");
      return;
    }

    abortImageSearch();
    abortTextSearch();

    setSearching(true);
    notifyError(null);

    try {
      const { controller, promise } = createTextSearchRequest(query, 50);
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
  }, [abortImageSearch, abortTextSearch, handleSearchResults, notifyError, textQuery]);

  const handleSearchClear = useCallback(() => {
    abortImageSearch();
    abortTextSearch();
    setTextQuery("");
    setSearchFile(null);
    setSearchPreview(null);
    setSearchResults([]);
    setDisplayMode("all");
    notifyError(null);
    setSearching(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [abortImageSearch, abortTextSearch, notifyError]);

  const handleKeyPress = useCallback((e) => {
    if (e.key === "Enter") {
      handleTextSearch();
    }
  }, [handleTextSearch]);

  return {
    searchType,
    setSearchType,
    textQuery,
    setTextQuery,
    searchFile,
    searchPreview,
    searchResults,
    searching,
    displayMode,
    setDisplayMode,
    fileInputRef,
    handleFileSelect,
    handleImageSearch,
    handleTextSearch,
    handleSearchClear,
    handleKeyPress,
  };
}
