import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createImageSearchRequest, createTextSearchRequest } from "../api";
import { buildImageUrl, IMAGES_BASE } from "../utils/generate";
import type { OffspringImage, SearchApiResult } from "../types/generate";

const buildSearchResult = (result: SearchApiResult, base: string) => {
  const cleanId = result.id.replace(/:(en|zh)$/i, "");
  return {
    filename: cleanId,
    url: buildImageUrl(base, cleanId),
  } satisfies OffspringImage;
};

export type UseGenerateSearchOptions = {
  imagesBase?: string;
  onError?: (message: string | null) => void;
  availableImages?: OffspringImage[];
};

export type UseGenerateSearchReturn = {
  textQuery: string;
  setTextQuery: (value: string) => void;
  searchResults: OffspringImage[];
  searching: boolean;
  displayMode: "all" | "search";
  setDisplayMode: (mode: "all" | "search") => void;
  handleTextSearch: () => Promise<void>;
  handleSearchClear: () => void;
  handleKeyPress: (e: KeyboardEvent<HTMLInputElement>) => void;
};

export default function useGenerateSearch({ imagesBase = IMAGES_BASE, onError, availableImages = [] }: UseGenerateSearchOptions = {}) {
  const [textQuery, setTextQuery] = useState("");
  const [searchResults, setSearchResults] = useState<OffspringImage[]>([]);
  const [searching, setSearching] = useState(false);
  const [displayMode, setDisplayMode] = useState<"all" | "search">("all");
  const textSearchControllerRef = useRef<AbortController | null>(null);

  const notifyError = useCallback(
    (message: string | null) => {
      if (onError) {
        onError(message);
      }
    },
    [onError],
  );

  const abortTextSearch = useCallback(() => {
    if (textSearchControllerRef.current) {
      textSearchControllerRef.current.abort();
      textSearchControllerRef.current = null;
    }
  }, []);

  const handleSearchResults = useCallback(
    (resultList: SearchApiResult[] | undefined | null, emptyMessage: string) => {
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
    [imagesBase, notifyError],
  );

  useEffect(() => {
    return () => {
      abortTextSearch();
    };
  }, [abortTextSearch]);

  const searchableImages = useMemo(() => availableImages ?? [], [availableImages]);

  const resolveImagePath = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return null;
      const lower = trimmed.toLowerCase();
      const exact = searchableImages.find((img) => img.filename.toLowerCase() === lower);
      if (exact) return exact.filename;
      const partial = searchableImages.find((img) => img.filename.toLowerCase().includes(lower));
      return partial?.filename ?? null;
    },
    [searchableImages],
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
        ? createImageSearchRequest(imageName, 50)
        : createTextSearchRequest(query, 50);
      textSearchControllerRef.current = controller;

      const searchResultsData = await promise;
      textSearchControllerRef.current = null;

      const resultList = searchResultsData.results || [];
      handleSearchResults(resultList, `未找到與「${query}」相關的圖像`);
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") {
        return;
      }
      setSearchResults([]);
      setDisplayMode("all");
      notifyError((err as Error)?.message || "搜尋出錯");
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

  const handleKeyPress = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleTextSearch();
      }
    },
    [handleTextSearch],
  );

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
  } satisfies UseGenerateSearchReturn;
}
