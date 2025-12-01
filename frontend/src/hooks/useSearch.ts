import { useCallback, useEffect, useRef, useState } from "react";
import {
  createImageSearchRequest,
  createImageUploadRequest,
  createTextSearchRequest,
} from "../api";
const DEFAULT_LIMIT = 15;

type SearchResult = { id: string; [key: string]: unknown };
type ImageUploadResult = { searchPath: string; fallbackPath?: string };

const normalizeResults = (payload: unknown): SearchResult[] => {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as { results?: unknown }).results;
  if (Array.isArray(results)) {
    return results as SearchResult[];
  }
  return [];
};

export default function useSearch({ limit = DEFAULT_LIMIT }: { limit?: number } = {}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [textQuery, setTextQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const imageSearchControllerRef = useRef<AbortController | null>(null);
  const textSearchControllerRef = useRef<AbortController | null>(null);

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

  const updateResults = useCallback((list: SearchResult[], emptyMessage: string | null) => {
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

  const handleFilePreview = useCallback((file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      setPreview(typeof result === "string" ? result : null);
    };
    reader.readAsDataURL(file);
  }, []);

  const selectFile = useCallback((file: File | null) => {
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

  const updateTextQuery = useCallback((value: string) => {
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
    async (
      primaryPath: string,
      fallbackPath: string | null = primaryPath,
      emptyMessage = "搜尋完成，但沒有找到相似的圖像",
    ) => {
      const execute = async (path: string) => {
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
        const abortName = (primaryError as { name?: string })?.name;
        if (abortName === "AbortError") {
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

  const uploadImage = useCallback(async (): Promise<ImageUploadResult> => {
    if (!selectedFile) {
      throw new Error("請先選擇圖片");
    }

    const { controller, promise } = createImageUploadRequest(selectedFile);
    uploadControllerRef.current = controller;
    const uploadResult = (await promise) as ImageUploadResult;
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
      const abortName = (err as { name?: string })?.name;
      if (abortName === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "搜尋出錯，請檢查瀏覽器控制台";
      console.error("搜尋出錯:", err);
      setError(message);
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
      const abortName = (err as { name?: string })?.name;
      if (abortName === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "搜尋出錯";
      console.error("搜尋出錯:", err);
      setError(message);
    } finally {
      setSearching(false);
    }
  }, [limit, textQuery, updateResults]);

  const searchFromResult = useCallback(
    async (imageId: string) => {
      abortAll();
      setSearching(true);
      setError(null);

      try {
        await runImageSearch(`backend/offspring_images/${imageId}`);
      } catch (err) {
        const abortName = (err as { name?: string })?.name;
        if (abortName === "AbortError") {
          return;
        }
        const message = err instanceof Error ? err.message : "搜尋出錯，請重試";
        console.error("搜尋出錯:", err);
        setError(message);
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
