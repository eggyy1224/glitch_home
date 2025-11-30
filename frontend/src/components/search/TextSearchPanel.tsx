import type { ChangeEvent, KeyboardEvent } from "react";

type TextSearchPanelProps = {
  textQuery: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  searching: boolean;
};

export default function TextSearchPanel({
  textQuery,
  onChange,
  onSearch,
  onClear,
  searching,
}: TextSearchPanelProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onSearch();
    }
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="search-mode__panel">
      <div className="search-mode__card">
        <input
          type="text"
          value={textQuery}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="輸入搜尋詞... 例如：白馬、夜晚、人物"
          className="search-mode__text-input"
        />
      </div>

      <div className="search-mode__controls">
        <button
          type="button"
          className="search-mode__button search-mode__button--primary"
          onClick={onSearch}
          disabled={!textQuery.trim() || searching}
        >
          {searching ? "🔄 搜尋中..." : "🚀 搜尋"}
        </button>
        {textQuery && (
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
