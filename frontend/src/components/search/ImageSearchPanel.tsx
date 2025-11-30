import type { ChangeEvent, KeyboardEvent, RefObject } from "react";

type ImageSearchPanelProps = {
  preview?: string | null;
  selectedFile: File | null;
  onFileChange: (file: File) => void;
  onSearch: () => void;
  onClear: () => void;
  searching: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
};

export default function ImageSearchPanel({
  preview,
  selectedFile,
  onFileChange,
  onSearch,
  onClear,
  searching,
  fileInputRef,
}: ImageSearchPanelProps) {
  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileChange(file);
    }
  };

  const handleTriggerUpload = () => {
    fileInputRef.current?.click();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleTriggerUpload();
    }
  };

  return (
    <div className="search-mode__panel">
      <div className="search-mode__card">
        {preview ? (
          <div className="search-mode__preview">
            <img src={preview} alt="預覽" className="search-mode__preview-img" />
            <p className="search-mode__file-name">{selectedFile?.name}</p>
          </div>
        ) : (
          <div
            className="search-mode__upload-prompt"
            role="button"
            tabIndex={0}
            onClick={handleTriggerUpload}
            onKeyDown={handleKeyDown}
          >
            <div className="search-mode__upload-icon">📸</div>
            <p>點擊上傳圖片或拖放</p>
            <p className="search-mode__upload-hint">支援 PNG, JPG, JPEG</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          onChange={handleFileInput}
          className="search-mode__file-input"
        />
      </div>

      <div className="search-mode__controls">
        <button
          type="button"
          className="search-mode__button search-mode__button--primary"
          onClick={onSearch}
          disabled={!selectedFile || searching}
        >
          {searching ? "🔄 搜尋中..." : "🚀 搜尋"}
        </button>
        {selectedFile && (
          <button
            type="button"
            className="search-mode__button search-mode__button--secondary"
            onClick={onClear}
            disabled={searching}
          >
            清除
          </button>
        )}
      </div>
    </div>
  );
}
