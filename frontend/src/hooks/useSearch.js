import { useCallback, useRef, useState } from "react";
import { searchImagesByImage, searchImagesByText } from "../api";

const API_BASE = import.meta.env.VITE_API_BASE || "";
const UPLOAD_ENDPOINT = `${API_BASE}/api/screenshots`;
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

  const updateResults = useCallback((list, emptyMessage) => {
    if (!list.length && emptyMessage) {
      setResults([]);
      setError(emptyMessage);
      return;
    }
    setResults(list);
  }, []);

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
    setSelectedFile(null);
    setPreview(null);
    setResults([]);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const updateTextQuery = useCallback((value) => {
    setTextQuery(value);
    if (!value) {
      setResults([]);
      setError(null);
    }
  }, []);

  const clearTextQuery = useCallback(() => {
    setTextQuery("");
    setResults([]);
    setError(null);
  }, []);

  const fetchImageResults = useCallback(async (path) => {
    const searchResults = await searchImagesByImage(path, limit);
    const normalized = normalizeResults(searchResults);
    updateResults(
      normalized,
      normalized.length ? null : "搜尋完成，但沒有找到相似的圖像"
    );
    return normalized;
  }, [limit, updateResults]);

  const runImageSearch = useCallback(
    async (primaryPath, fallbackPath = primaryPath) => {
      try {
        return await fetchImageResults(primaryPath);
      } catch (primaryError) {
        if (fallbackPath && fallbackPath !== primaryPath) {
          return fetchImageResults(fallbackPath);
        }
        throw primaryError;
      }
    },
    [fetchImageResults]
  );

  const uploadImage = useCallback(async () => {
    if (!selectedFile) {
      throw new Error("請先選擇圖片");
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    const uploadRes = await fetch(UPLOAD_ENDPOINT, {
      method: "POST",
      body: formData,
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      throw new Error(`圖片上傳失敗 (${uploadRes.status}): ${errorText}`);
    }

    const uploadData = await uploadRes.json();
    const uploadedPath = uploadData.absolute_path || uploadData.relative_path;

    if (!uploadedPath) {
      throw new Error("上傳成功但無法取得檔案路徑");
    }

    const searchPath = uploadData.original_filename
      ? `backend/offspring_images/${uploadData.original_filename}`
      : uploadedPath;

    return {
      searchPath,
      fallbackPath: uploadedPath,
    };
  }, [selectedFile]);

  const searchByImage = useCallback(async () => {
    if (!selectedFile) {
      setError("請先選擇圖片");
      return;
    }

    setSearching(true);
    setError(null);
    setResults([]);

    try {
      const { searchPath, fallbackPath } = await uploadImage();
      await runImageSearch(searchPath, fallbackPath);
    } catch (err) {
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

    setSearching(true);
    setError(null);
    setResults([]);

    try {
      const searchResults = await searchImagesByText(query, limit);
      const normalized = normalizeResults(searchResults);
      updateResults(
        normalized,
        normalized.length ? null : `未找到與「${query}」相關的圖像`
      );
    } catch (err) {
      console.error("搜尋出錯:", err);
      setError(err.message || "搜尋出錯");
    } finally {
      setSearching(false);
    }
  }, [limit, textQuery, updateResults]);

  const searchFromResult = useCallback(
    async (imageId) => {
      setSearching(true);
      setError(null);

      try {
        await runImageSearch(`backend/offspring_images/${imageId}`);
      } catch (err) {
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
