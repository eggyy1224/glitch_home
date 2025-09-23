## 圖像循環合成器開發規格（Spec）

### 專案目標

本專案旨在開發一個圖像循環合成器，透過 AI 圖像生成模型自動進行圖片融合及進化，建立一個循環回饋機制，並提供視覺化的圖像親緣追溯系統以及基於向量語意的搜尋功能。前端採用 React，後端使用 FastAPI，資料庫使用 Chroma DB，API 服務統一使用 Google 提供的服務。

### 核心功能

#### 1. 圖像基因池

* 建立一個資料夾 (`genes_pool`)，用以存放初始圖像。
* 每次運行時從此資料夾隨機選取圖像。

#### 2. 圖像生成（使用 Gemini 2.5 Flash Image）

* 使用 Google Gemini 2.5 Flash Image API 進行圖像生成。
* 採用 Image-to-image 方式：

  * 支援調整影響程度（Strength）：0.5-0.7。
  * Prompt 組成方式：固定文字描述（e.g., "cinematic style, atmospheric lighting, digital art"）加上隨機選取圖像的特徵描述。
* 預設每次生成 1 張（可配置，可透過參數或設定調整）。

#### 3. 圖像儲存與管理

* 生成的新圖像存放於專用資料夾 (`offspring_images`) 中。
* 每次生成的圖像應有唯一命名格式，如：`offspring_YYYYMMDD_HHMMSS_[序號].png`
* 每個新生成的圖像需附帶 JSON metadata 記錄其親代圖像資訊，包括檔案名稱及生成時間。

#### 4. 圖像篩選與回饋機制

* 支援人工篩選：人工手動挑選喜愛的圖像。
* 篩選出的優秀圖像重新回饋到基因池中 (`genes_pool`)，作為下一輪合成的來源。

#### 5. 視覺化親緣追溯系統

* 開發一個 React 前端視覺化介面，以樹狀圖或網狀圖清楚呈現圖像的親緣關係。
* 透過 metadata，自動建立圖像之間的連結，追溯每個圖像的所有親代與子代。

#### 6. 向量語意搜尋系統

* 使用 Chroma DB 建立向量化搜尋系統，透過 Google 提供的 AI 模型將圖像轉換成向量嵌入（embedding）。
* 支援透過文字描述或圖像內容進行語意搜尋，快速定位相關的圖像。

#### 7. 後端 API（FastAPI）

* 使用 FastAPI 建立後端 API 提供：

  * 圖像生成
  * 親緣資料管理
  * 向量搜尋功能
  * 圖像儲存與管理接口
* 所有 API 均透過 Google API 提供相關服務。

#### 8. 循環生成機制

* 建立簡單的自動循環機制，每次執行流程：

  * 從基因池隨機抽取。
  * 透過 Gemini 2.5 Flash Image 模型生成新圖像。
  * 儲存結果，待人工篩選。

### 資料夾結構

```
image_loop_synthesizer/
├── frontend/             # React 前端程式碼
├── backend/              # FastAPI 後端程式碼
├── genes_pool/           # 原始及優選圖像
├── offspring_images/     # AI 生成的新圖像
├── metadata/             # 圖像親緣關係紀錄（JSON格式）
├── embeddings/           # 圖像嵌入向量儲存
├── scripts/
│   ├── image_gen.py      # 圖像生成與處理腳本
│   ├── lineage_tracker.py # 親緣關係追蹤腳本
│   └── vector_search.py  # 向量化搜尋腳本
├── venv/                 # Python 虛擬環境 (Python 3.10)
└── README.md             # 專案說明文件
```

### 技術需求

* Python \~3.10
* 虛擬環境管理工具 (如 venv, virtualenv)
* Google Gemini 2.5 Flash Image API
* PIL 或 OpenCV 處理圖片
* 視覺化庫（如 D3.js 或 NetworkX + Matplotlib）
* Google 提供的圖像嵌入向量服務
* Chroma DB 向量資料庫
* React 前端框架
* FastAPI 後端框架

### API 互動流程

1. 從 `genes_pool` 隨機抽取圖像。
2. 呼叫 Google Gemini 2.5 Flash Image API 進行 Image-to-image 圖像生成。
3. 將生成結果及其親緣資訊儲存於對應資料夾。
4. 自動產生圖像的向量嵌入並儲存至 Chroma DB，以支援後續搜尋功能。
5. 視覺化介面自動更新並顯示最新的圖像親緣關係。

### 擴充性

未來可整合語言模型、聲音模型等多模態循環互動。
