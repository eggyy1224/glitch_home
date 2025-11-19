## Backend 測試覆蓋率提升計劃（2025-11）

### 目標
- 現況 55% → 兩週內達 65%，三週內朝 70% 前進。
- 關鍵模組（collage、kinship、screenshot/sound）覆蓋率至少 40%。
- CI 新增 `pytest --cov=app --cov-report=term-missing --cov-fail-under=65`（先允許失敗，達標後改為必過）。

### 行動項目
1. **Collage 生成核心 (`app/services/collage_version.py`)**
   - 在 `tests/test_services/` 建立 fixture（mock `CollageVersionRequest`, `GenesPool`, `ImageOutputs`），測成功/素材不足/例外。
   - `tests/test_api/test_media.py` 擴充 `/api/generate/collage-version`、`/api/generate/mix-two` 輪詢與錯誤流程。
2. **Kinship 搜尋與索引 (`app/api/kinship.py`, `app/services/kinship_index.py`)**
   - 建立測試資料（JSON/in-memory graph），驗證有結果、無結果、不同 depth、invalid params。
   - 補 `KinshipIndex.search/load_cache` 單元測試，涵蓋 cache miss / I/O 例外。
3. **截圖與音訊流程**
   - `app/api/screenshot.py`, `app/services/screenshot_queue.py`: 使用 `tmp_path`, fake timers 測 enqueue/dequeue、timeout、檔案缺失。
   - `app/api/sound.py`, `app/services/tts_openai.py`, `app/services/sound_effects.py`: mock OpenAI/TTS 客戶端與檔案輸出，覆蓋成功/失敗 path。
4. **Utility 與外部呼叫**
   - `app/utils/gemini_client.py`, `app/utils/embeddings.py`: monkeypatch API key 缺失、HTTP 例外，檢查 fallback 行為。
5. **追蹤與工具**
   - 新增 `tests/coverage/README.md`（或擴充 `AGENTS.md`）詳述 coverage 指令、HTML 報告產生方式。
   - 在測試模組加 `pytest` markers（`api`, `slow`, `integration`）以利 CI 選擇性執行。

### 時程
| 週次 | 里程碑 |
| --- | --- |
| Week 1 | Collage + Kinship 測試完成，總覆蓋 ≥60% |
| Week 2 | 截圖/音訊測試落地，啟用 CI coverage gate |
| Week 3+ | Utils/外部呼叫補齊，總覆蓋推進至 ≥70% |

### 待跟進
- [ ] 將 `datetime.utcnow()` 換成 `datetime.now(datetime.UTC)` 或等效方案以消 Deprecation warning。
- [ ] 規劃自動上傳 `htmlcov/` 為 CI artifact，便於審視缺漏行。
