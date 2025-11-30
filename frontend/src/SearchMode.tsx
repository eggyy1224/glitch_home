import React, { useState } from "react";
import useSearch from "./hooks/useSearch";
import ImageSearchPanel from "./components/search/ImageSearchPanel";
import TextSearchPanel from "./components/search/TextSearchPanel";
import SearchResultsGrid from "./components/search/SearchResultsGrid";
import "./styles/search-mode.css";

const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";

export interface SearchModeProps {
  imagesBase?: string;
}

type SearchType = "image" | "text";

export default function SearchMode({ imagesBase = IMAGES_BASE }: SearchModeProps) {
  const [searchType, setSearchType] = useState<SearchType>("image");
  const {
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
    setTextQuery,
    searchByText,
    clearTextQuery,
    searchFromResult,
  } = useSearch();

  return (
    <div className="search-mode__container">
      <div className="search-mode__header">
        <h1>🔍 相似度搜尋</h1>
        <p>以圖片或文字搜尋相似的後代影像</p>
      </div>

      <div className="search-mode__mode-selector">
        <button
          type="button"
          className={`search-mode__mode-button ${searchType === "image" ? "is-active" : ""}`}
          onClick={() => setSearchType("image")}
          aria-pressed={searchType === "image"}
        >
          📸 以圖搜圖
        </button>
        <button
          type="button"
          className={`search-mode__mode-button ${searchType === "text" ? "is-active" : ""}`}
          onClick={() => setSearchType("text")}
          aria-pressed={searchType === "text"}
        >
          📝 文字搜尋
        </button>
      </div>

      {searchType === "image" && (
        <ImageSearchPanel
          preview={preview}
          selectedFile={selectedFile}
          onFileChange={selectFile}
          onSearch={searchByImage}
          onClear={clearFileSelection}
          searching={searching}
          fileInputRef={fileInputRef}
        />
      )}

      {searchType === "text" && (
        <TextSearchPanel
          textQuery={textQuery}
          onChange={setTextQuery}
          onSearch={searchByText}
          onClear={clearTextQuery}
          searching={searching}
        />
      )}

      {error && <div className="search-mode__error">{error}</div>}

      <SearchResultsGrid
        results={results}
        imagesBase={imagesBase}
        onResultClick={searchFromResult}
      />
    </div>
  );
}
