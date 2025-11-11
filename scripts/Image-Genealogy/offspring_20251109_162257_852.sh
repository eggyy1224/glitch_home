#!/usr/bin/env bash

set -euo pipefail

# 基本設定，可透過環境變數覆寫
API_BASE="${API_BASE:-http://localhost:8000}"
TARGET_CLIENT_ID="${TARGET_CLIENT_ID:-image_genealogy}"
IMAGE_NAME="${IMAGE_NAME:-offspring_20251109_162257_852.png}"
SCAN_PANEL_ID="${SCAN_PANEL_ID:-scan-calibration}"
SCAN_GAP="${SCAN_GAP:-0}"
SCAN_HOLD_SECONDS="${SCAN_HOLD_SECONDS:-20}"
SCAN_SUBTITLE_TEXT="${SCAN_SUBTITLE_TEXT:-$'維持掃描頻寬，等待織體穩定\nHold the bandwidth steady and let the weave settle.'}"
SCAN_SUBTITLE_DURATION="${SCAN_SUBTITLE_DURATION:-8}"
CAPTION_LANG="${CAPTION_LANG:-zh-TW}"

if ! command -v jq >/dev/null 2>&1; then
  echo "錯誤：此腳本需要 'jq'，請先安裝後再執行。" >&2
  exit 2
fi

require_client_online() {
  local clients_json
  clients_json="$(curl -fsS "${API_BASE}/api/clients")"

  if ! echo "${clients_json}" | jq -e --arg client "${TARGET_CLIENT_ID}" '.clients | any(.client_id == $client and .connections > 0)' >/dev/null; then
    echo "✗ 找不到作用中的 client '${TARGET_CLIENT_ID}'，請先在前端載入 '?iframe_mode=true&client=${TARGET_CLIENT_ID}'" >&2
    exit 1
  fi
}

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
  local prefix="$4"
  local gap="$5"

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

  curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
    -H "Content-Type: application/json" \
    -d "${payload}" >/dev/null

  echo "✓ layout 已更新：columns=${columns} panel_count=${panel_count}"
}

push_caption() {
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

stage_scan_calibration() {
  echo ""
  echo "=== Stage 1：掃描校準（Scan Calibration） ==="
  apply_layout "鎖定單格 scan 模式" 1 1 "${SCAN_PANEL_ID}" "${SCAN_GAP}"
  echo "⏳ 推送字幕，敘述掃描校準狀態..."
  push_caption "${SCAN_SUBTITLE_TEXT}" "${SCAN_SUBTITLE_DURATION}"
  echo "⏳ 保持單格掃描 ${SCAN_HOLD_SECONDS} 秒，讓觀眾閱讀橫向織帶。"
  sleep "${SCAN_HOLD_SECONDS}"
  echo "✓ Stage 1 完成。"
}

main() {
  echo "=== offspring_20251109_162257_852｜場景草稿 ==="
  echo "目標 client：${TARGET_CLIENT_ID}"
  require_client_online
  stage_scan_calibration
  echo ""
  echo "👉 下一步可在此腳本後續新增 Stage 2/3，以父層影像與系譜節奏串接。"
}

main "$@"
