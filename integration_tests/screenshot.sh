#!/usr/bin/env bash

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"
TARGET_CLIENT_ID="${TARGET_CLIENT_ID:-integration_test}"
REQUEST_LABEL="${REQUEST_LABEL:-integration 測試截圖}"
POLL_INTERVAL="${POLL_INTERVAL:-2}"
TIMEOUT_SECONDS="${TIMEOUT_SECONDS:-60}"

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: 'jq' is required but not found in PATH." >&2
  exit 2
fi

echo "=== 截圖流程整合測試 ==="
echo "➜ API_BASE: ${API_BASE}"
echo "➜ 目標 Client ID: ${TARGET_CLIENT_ID}"
echo ""

echo "➜ 檢查指定客戶端是否在線..."
clients_json="$(curl -fsS "${API_BASE}/api/clients")"
if ! echo "${clients_json}" | jq -e --arg client "${TARGET_CLIENT_ID}" '.clients | any(.client_id == $client and .connections > 0)' >/dev/null; then
  echo "✗ 找不到連線中的客戶端 '${TARGET_CLIENT_ID}'。" >&2
  echo "  請先在前端以 '?client=${TARGET_CLIENT_ID}' 參數開啟頁面後再重試。" >&2
  exit 1
fi
echo "✓ 客戶端已連線。"
echo ""

echo "➜ 建立截圖請求..."
request_payload="$(jq -n --arg client "${TARGET_CLIENT_ID}" --arg label "${REQUEST_LABEL}" '{client_id: $client, label: $label}')"
request_json="$(curl -fsS -X POST "${API_BASE}/api/screenshots/request" \
  -H "Content-Type: application/json" \
  -d "${request_payload}")"
request_id="$(echo "${request_json}" | jq -r '.id // empty')"

if [ -z "${request_id}" ]; then
  echo "✗ 後端回傳內容異常，無法取得 request_id：" >&2
  echo "${request_json}" >&2
  exit 1
fi
echo "✓ 已送出截圖請求，ID=${request_id}"
echo ""

echo "➜ 等待截圖完成 (timeout ${TIMEOUT_SECONDS}s, 每 ${POLL_INTERVAL}s 輪詢)..."

deadline=$((SECONDS + TIMEOUT_SECONDS))
result_json=""
while :; do
  if (( SECONDS > deadline )); then
    echo "✗ 截圖等待逾時。" >&2
    exit 1
  fi

  result_json="$(curl -fsS "${API_BASE}/api/screenshots/${request_id}")"
  status="$(echo "${result_json}" | jq -r '.status // empty')"

  case "${status}" in
    completed)
      echo "✓ 截圖成功。"
      break
      ;;
    failed)
      error_msg="$(echo "${result_json}" | jq -r '.error // \"unknown error\"')"
      echo "✗ 截圖失敗：${error_msg}" >&2
      exit 1
      ;;
    pending|"")
      sleep "${POLL_INTERVAL}"
      ;;
    *)
      echo "✗ 未知狀態：${status}" >&2
      echo "${result_json}" >&2
      exit 1
      ;;
  esac
done
echo ""

relative_path="$(echo "${result_json}" | jq -r '.result.relative_path // empty')"
absolute_path="$(echo "${result_json}" | jq -r '.result.absolute_path // empty')"
original_filename="$(echo "${result_json}" | jq -r '.result.original_filename // empty')"

echo "=== 截圖結果 ==="
echo "Request ID : ${request_id}"
echo "原始檔名   : ${original_filename}"
echo "相對路徑   : ${relative_path}"
echo "絕對路徑   : ${absolute_path}"

if [ -n "${absolute_path}" ] && [ -f "${absolute_path}" ]; then
  echo ""
  echo "➜ 檔案資訊："
  ls -lh "${absolute_path}"
else
  echo ""
  echo "⚠ 無法確認檔案是否存在，請手動檢查路徑。" >&2
fi
