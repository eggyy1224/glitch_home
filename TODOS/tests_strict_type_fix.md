# 前端測試嚴格型別 TODO

## 目標
- 將 `tests` 全部納入 `tsconfig.strict.json` 嚴格型別並通過 `npm run typecheck:strict`。
- 建立共用測試型別/假物件 utilities，減少重複修正。

## 任務拆解
1) 建立共用 helpers（已完成）
   - 位置：`tests/testUtils/`
   - 內容：typed `mockFetch/mockApi`、OverlayContent/IframeConfig/CollageConfig 樣板、DOM ref/fake timers helpers。
   - 實作：`tests/testUtils/mockHelpers.ts`、`tests/testUtils/sampleData.ts`、`tests/testUtils/dom.ts`、`tests/testUtils/index.ts`
2) Components 測試修正
   - 檔案：`tests/components/**`
   - 重點：補足必填 props、ref/null 守衛、使用共用樣板，移除 implicit any/rest any。
3) Hooks/API 測試修正
   - 檔案：`tests/unit/hooks/**`、`tests/unit/api.test.ts`、`tests/unit/utils/request.test.ts`
   - 重點：vi mock 具體化（mockReturnValue/mockResolvedValue），處理 unknown/null refs。
4) Utils/E2E 假物件修正
   - 檔案：`tests/unit/utils/**`、`tests/e2e/display.spec.ts`
   - 重點：補 FakeImage/FakeCanvas 型別、Iframe panels 必填欄位、Playwright handler 型別。
5) 驗證
   - 命令：`npm run typecheck:strict -- --pretty false`

## 依賴
- 需先保留 `tsconfig.strict.json` include `["src","tests"]`。
