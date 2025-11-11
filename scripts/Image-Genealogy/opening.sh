#!/usr/bin/env bash

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"
TARGET_CLIENT_ID="${TARGET_CLIENT_ID:-image_genealogy}"
IMAGE_NAME="${IMAGE_NAME:-offspring_20251109_162257_852.png}"
PANEL_ID="${PANEL_ID:-opening_slide}"
CAPTION_TEXT="${CAPTION_TEXT:-圖像系譜學 Image Genealogy}"
CAPTION_DURATION="${CAPTION_DURATION:-15}"
CAPTION_LANG="${CAPTION_LANG:-zh-TW}"

if ! command -v jq >/dev/null 2>&1; then
  echo "錯誤：此腳本需要 'jq'，請先安裝後再執行。" >&2
  exit 2
fi

echo "=== Image Genealogy Opening ==="
echo "➜ 檢查 client 是否在線：${TARGET_CLIENT_ID}"

clients_json="$(curl -fsS "${API_BASE}/api/clients")"

if ! echo "${clients_json}" | jq -e --arg client "${TARGET_CLIENT_ID}" '.clients | any(.client_id == $client and .connections > 0)' >/dev/null; then
  echo "✗ 找不到作用中的 client '${TARGET_CLIENT_ID}'，請先在前端載入 '?iframe_mode=true&client=${TARGET_CLIENT_ID}'" >&2
  exit 1
fi

echo "✓ client 在線，準備套用開場幻燈片..."

build_panels_json() {
  local count="$1"
  local prefix="$2"
  jq -cn --arg image "${IMAGE_NAME}" --arg prefix "${prefix}" --argjson count "${count}" '
    [range(1; $count + 1) as $idx | {
      id: (if $count == 1 then $prefix else $prefix + "-" + ($idx | tostring) end),
      image: $image,
      params: {slide_mode: "true"},
      ratio: 1
    }]
  '
}

apply_layout() {
  local title="$1"
  local columns="$2"
  local panel_count="$3"
  local hold_seconds="$4"
  local prefix="$5"
  local gap="${6:-8}"

  echo ""
  echo "➜ ${title}"

  local panels_json
  panels_json="$(build_panels_json "${panel_count}" "${prefix}")"

  local payload
  payload="$(
    jq -n \
      --arg target "${TARGET_CLIENT_ID}" \
      --argjson columns "${columns}" \
      --argjson gap "${gap}" \
      --argjson panels "${panels_json}" \
      '{
        target_client_id: $target,
        layout: "grid",
        gap: $gap,
        columns: $columns,
        panels: $panels
      }'
  )"

  local response
  response="$(
    curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
      -H "Content-Type: application/json" \
      -d "${payload}"
  )"

  local panel_count_returned
  panel_count_returned="$(echo "${response}" | jq '.panels | length')"
  echo "✓ 套用完成：${panel_count_returned} 面板，columns=${columns}"

  if (( hold_seconds > 0 )); then
    echo "⏳ 停留 ${hold_seconds} 秒..."
    sleep "${hold_seconds}"
  fi
}

set_caption() {
  local text="$1"
  local duration="$2"
  local payload
  payload="$(
    jq -n \
      --arg text "${text}" \
      --arg lang "${CAPTION_LANG}" \
      --argjson duration "${duration}" \
      '{text: $text, language: $lang, duration_seconds: $duration}'
  )"

  curl -fsS -X POST "${API_BASE}/api/captions?target_client_id=${TARGET_CLIENT_ID}" \
    -H "Content-Type: application/json" \
    -d "${payload}" >/dev/null
}

apply_caption_layout() {
  local caption_url="/?caption_mode=true"
  if [[ -n "${TARGET_CLIENT_ID}" ]]; then
    caption_url="${caption_url}&client=${TARGET_CLIENT_ID}"
  fi

  local payload
  payload="$(
    jq -n \
      --arg target "${TARGET_CLIENT_ID}" \
      --arg url "${caption_url}" \
      '{
        target_client_id: $target,
        layout: "grid",
        gap: 0,
        columns: 1,
        panels: [
          {
            id: "caption",
            url: $url,
            ratio: 1
          }
        ]
      }'
  )"

  curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
    -H "Content-Type: application/json" \
    -d "${payload}" >/dev/null
}

# 初始單格 slide_mode
apply_layout "開場：單格 Slide Mode" 1 1 0 "${PANEL_ID}" 0
echo ""
echo "提示：在前端開啟 http://localhost:5173/?iframe_mode=true&client=${TARGET_CLIENT_ID} 就能看到單格 slide_mode 畫面。"

echo "⏳ 保持單格畫面 10 秒..."
sleep 10

# 依序切換：2 格 → 4 格 → 16 格 → 100 格
apply_layout "切換為雙格展示" 2 2 5 "two-panel" 12
apply_layout "切換為四格展示" 2 4 3 "four-panel" 12
apply_layout "切換為 16 格矩陣" 4 16 1 "sixteen-grid" 6
apply_layout "切換為 100 格矩陣" 10 100 0 "hundred-grid" 2

echo ""
echo "⏳ 100 格畫面停留 30 秒..."
sleep 30

echo "➜ 切換至 Caption 標題頁..."
apply_caption_layout
echo "➜ 推送 Caption 文字：「${CAPTION_TEXT}」"
set_caption "${CAPTION_TEXT}" "${CAPTION_DURATION}"
echo "✓ Caption 模式已啟動，顯示 ${CAPTION_DURATION} 秒。"
echo ""
echo "🎬 開場序列完成：單格 → 2 格 → 4 格 → 16 格 → 100 格 → Caption 標題頁，全程使用 ${IMAGE_NAME}。"
