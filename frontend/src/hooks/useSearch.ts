import { useCallback, useEffect, useRef, useState } from "react";
import {
  createImageSearchRequest,
  createImageUploadRequest,
  createTextSearchRequest,
} from "../api";
const DEFAULT_LIMIT = 15;

const normalizeResults = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload.results)) {
    return payload.results;
  }
  return [];
};

export default function useSearch({ limit = DEFAULT_LIMIT } = {}) {
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [textQuery, setTextQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  const uploadControllerRef = useRef(null);
  const imageSearchControllerRef = useRef(null);
  const textSearchControllerRef = useRef(null);

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

  const abortAll = useCallback(() => {
    abortImageSearch();
    abortTextSearch();
  }, [abortImageSearch, abortTextSearch]);

  const updateResults = useCallback((list, emptyMessage) => {
    if (!list.length && emptyMessage) {
      setResults([]);
      setError(emptyMessage);
      return;
    }
    setError(null);
    setResults(list);
  }, []);

  useEffect(() => {
    return () => {
      abortAll();
    };
  }, [abortAll]);

  const handleFilePreview = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target.result);
    };
    reader.readAsDataURL(file);
  }, []);

  const selectFile = useCallback((file) => {
    if (!file) return;
    setSelectedFile(file);
    setError(null);
    setResults([]);
    handleFilePreview(file);
  }, [handleFilePreview]);

  const clearFileSelection = useCallback(() => {
    abortImageSearch();
    setSelectedFile(null);
    setPreview(null);
    setResults([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [abortImageSearch]);

  const updateTextQuery = useCallback((value) => {
    setTextQuery(value);
    if (!value) {
      setResults([]);
      setError(null);
    }
  }, []);

  const clearTextQuery = useCallback(() => {
    abortTextSearch();
    setTextQuery("");
    setResults([]);
    setError(null);
  }, [abortTextSearch]);

  const runImageSearch = useCallback(
    async (primaryPath, fallbackPath = primaryPath, emptyMessage = "搜尋完成，但沒有找到相似的圖像") => {
      const execute = async (path) => {
        const { controller, promise } = createImageSearchRequest(path, limit);
        imageSearchControllerRef.current = controller;
        const searchResults = await promise;
        imageSearchControllerRef.current = null;
        const normalized = normalizeResults(searchResults);
        updateResults(normalized, normalized.length ? null : emptyMessage);
        return normalized;
      };

      try {
        return await execute(primaryPath);
      } catch (primaryError) {
        if (primaryError.name === "AbortError") {
          throw primaryError;
        }
        if (fallbackPath && fallbackPath !== primaryPath) {
          return execute(fallbackPath);
        }
        throw primaryError;
      }
    },
    [limit, updateResults]
  );

  const uploadImage = useCallback(async () => {
    if (!selectedFile) {
      throw new Error("請先選擇圖片");
    }

    const { controller, promise } = createImageUploadRequest(selectedFile);
    uploadControllerRef.current = controller;
    const uploadResult = await promise;
    uploadControllerRef.current = null;
    return uploadResult;
  }, [selectedFile]);

  const searchByImage = useCallback(async () => {
    if (!selectedFile) {
      setError("請先選擇圖片");
      return;
    }

    abortAll();
    setSearching(true);
    setError(null);
    setResults([]);

    try {
      const { searchPath, fallbackPath } = await uploadImage();
      await runImageSearch(searchPath, fallbackPath);
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      console.error("搜尋出錯:", err);
      setError(err.message || "搜尋出錯，請檢查瀏覽器控制台");
    } finally {
      setSearching(false);
    }
  }, [selectedFile, runImageSearch, uploadImage]);

  const searchByText = useCallback(async () => {
    const query = textQuery.trim();
    if (!query) {
      setError("請輸入搜尋詞");
      return;
    }

    abortAll();
    setSearching(true);
    setError(null);
    setResults([]);

    try {
      const { controller, promise } = createTextSearchRequest(query, limit);
      textSearchControllerRef.current = controller;
      const searchResults = await promise;
      textSearchControllerRef.current = null;
      const normalized = normalizeResults(searchResults);
      updateResults(normalized, normalized.length ? null : `未找到與「${query}」相關的圖像`);
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      console.error("搜尋出錯:", err);
      setError(err.message || "搜尋出錯");
    } finally {
      setSearching(false);
    }
  }, [limit, textQuery, updateResults]);

  const searchFromResult = useCallback(
    async (imageId) => {
      abortAll();
      setSearching(true);
      setError(null);

      try {
        await runImageSearch(`backend/offspring_images/${imageId}`);
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        console.error("搜尋出錯:", err);
        setError(err.message || "搜尋出錯，請重試");
      } finally {
        setSearching(false);
      }
    },
    [runImageSearch]
  );

  return {
    fileInputRef,
    preview,
    selectedFile,
    textQuery,
    results,
    searching,
    error,
    selectFile,
    clearFileSelection,
    searchByImage,
    setTextQuery: updateTextQuery,
    searchByText,
    clearTextQuery,
    searchFromResult,
  };
}
