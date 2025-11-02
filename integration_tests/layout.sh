#!/usr/bin/env bash

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"
TARGET_CLIENT_ID="${TARGET_CLIENT_ID:-integration_test}"
CAPTION_CLIENT_ID="integration_test_caption"

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: 'jq' is required but not found in PATH." >&2
  exit 2
fi

echo "=== layout 測試 ==="
echo "➜ Checking whether client '${TARGET_CLIENT_ID}' is connected..."

clients_json="$(curl -fsS "${API_BASE}/api/clients")"

if echo "${clients_json}" | jq -e --arg client "${TARGET_CLIENT_ID}" '.clients | any(.client_id == $client and .connections > 0)' >/dev/null; then
  echo "✓ Client '${TARGET_CLIENT_ID}' is connected."
  
  echo ""
  echo "➜ Setting caption for inner caption_mode panel (client: ${CAPTION_CLIENT_ID})..."
  caption_response="$(curl -fsS -X POST "${API_BASE}/api/captions?target_client_id=${CAPTION_CLIENT_ID}" \
    -H "Content-Type: application/json" \
    -d '{
      "text": "layout 測試",
      "language": "zh-TW",
      "duration_seconds": 60
    }')"
  
  if echo "${caption_response}" | jq -e '.caption.text' >/dev/null 2>&1; then
    echo "✓ Caption set successfully for ${CAPTION_CLIENT_ID}"
  else
    echo "✗ Failed to set caption."
    echo "Server response:"
    echo "${caption_response}"
    exit 1
  fi

  echo ""
  echo "➜ Initializing iframe with Caption Mode (using separate client)..."
  iframe_init="$(curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
    -H "Content-Type: application/json" \
    -d "{
      \"target_client_id\": \"${TARGET_CLIENT_ID}\",
      \"layout\": \"grid\",
      \"gap\": 12,
      \"columns\": 1,
      \"panels\": [
        {
          \"id\": \"caption\",
          \"url\": \"/?caption_mode=true&client=${CAPTION_CLIENT_ID}\",
          \"ratio\": 1,
          \"label\": \"Caption Mode\"
        }
      ]
    }")"
  
  if echo "${iframe_init}" | jq -e '.panels[0]' >/dev/null 2>&1; then
    echo "✓ Initial iframe configured - Caption Mode panel ready"
  else
    echo "✗ Failed to initialize iframe configuration."
    exit 1
  fi
  
  echo ""
  echo "➜ PHASE 0: Displaying Caption (5 seconds)..."
  echo "✓ Caption panel is ready with 'layout 測試'"
  
  echo "⏳ Waiting 5 seconds (showing caption in iframe panel)..."
  sleep 5

  echo ""
  echo "➜ PHASE 1: Setting single slide_mode panel (5 seconds)..."
  iframe_config_1="$(curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
    -H "Content-Type: application/json" \
    -d "{
      \"target_client_id\": \"${TARGET_CLIENT_ID}\",
      \"layout\": \"grid\",
      \"gap\": 12,
      \"columns\": 1,
      \"panels\": [
        {
          \"id\": \"slide\",
          \"url\": \"/?slide_mode=true&img=offspring_20250929_114732_835.png\",
          \"ratio\": 1,
          \"label\": \"Slide Mode\"
        }
      ]
    }")"
  
  if echo "${iframe_config_1}" | jq -e '.panels[0]' >/dev/null 2>&1; then
    echo "✓ Phase 1 configured - Single panel iframe"
    
    echo "➜ Setting subtitle for Phase 1..."
    curl -fsS -X POST "${API_BASE}/api/subtitles?target_client_id=${TARGET_CLIENT_ID}" \
      -H "Content-Type: application/json" \
      -d '{
        "text": "🎬 播放模式 - 單張圖片",
        "language": "zh-TW",
        "duration_seconds": 5
      }' >/dev/null
    echo "✓ Subtitle set"
  else
    echo "✗ Failed to set Phase 1 configuration."
    exit 1
  fi

  echo "⏳ Waiting 5 seconds..."
  sleep 5

  echo ""
  echo "➜ PHASE 2: Switching to Two-Column Layout..."
  iframe_config_2="$(curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
    -H "Content-Type: application/json" \
    -d "{
      \"target_client_id\": \"${TARGET_CLIENT_ID}\",
      \"layout\": \"grid\",
      \"gap\": 12,
      \"columns\": 2,
      \"panels\": [
        {
          \"id\": \"left\",
          \"url\": \"/?slide_mode=true&img=offspring_20250929_114732_835.png\",
          \"ratio\": 1,
          \"label\": \"Left Panel\"
        },
        {
          \"id\": \"right\",
          \"url\": \"/?slide_mode=true&img=offspring_20250929_112621_888.png\",
          \"ratio\": 1,
          \"label\": \"Right Panel\"
        }
      ]
    }")"
  
  if echo "${iframe_config_2}" | jq -e '.panels[0]' >/dev/null 2>&1; then
    echo "✓ Phase 2 configured - Two-Column Layout"
    
    echo "➜ Setting subtitle for Phase 2..."
    curl -fsS -X POST "${API_BASE}/api/subtitles?target_client_id=${TARGET_CLIENT_ID}" \
      -H "Content-Type: application/json" \
      -d '{
        "text": "📊 並排模式 - 左右分割顯示",
        "language": "zh-TW",
        "duration_seconds": 10
      }' >/dev/null
    echo "✓ Subtitle set"
  else
    echo "✗ Failed to set Phase 2 configuration."
    echo "Server response:"
    echo "${iframe_config_2}"
    exit 1
  fi

  echo "⏳ Waiting 10 seconds..."
  sleep 10

  # PHASE 3: 4 Grid (2x2)
  echo ""
  echo "➜ PHASE 3: Switching to 4 Grid (2x2)..."
  iframe_config_3="$(curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
    -H "Content-Type: application/json" \
    -d "{
      \"target_client_id\": \"${TARGET_CLIENT_ID}\",
      \"layout\": \"grid\",
      \"gap\": 12,
      \"columns\": 2,
      \"panels\": [
        {\"id\": \"p1\", \"url\": \"/?slide_mode=true&img=offspring_20250929_114732_835.png\", \"ratio\": 1},
        {\"id\": \"p2\", \"url\": \"/?slide_mode=true&img=offspring_20250929_112621_888.png\", \"ratio\": 1},
        {\"id\": \"p3\", \"url\": \"/?slide_mode=true&img=offspring_20250927_141336_787.png\", \"ratio\": 1},
        {\"id\": \"p4\", \"url\": \"/?slide_mode=true&img=offspring_20251001_181913_443.png\", \"ratio\": 1}
      ]
    }")"
  
  if echo "${iframe_config_3}" | jq -e '.panels[0]' >/dev/null 2>&1; then
    echo "✓ Phase 3 configured - 4 Grid"
    curl -fsS -X POST "${API_BASE}/api/subtitles?target_client_id=${TARGET_CLIENT_ID}" \
      -H "Content-Type: application/json" \
      -d '{"text": "🔲 4 格 布局 (2x2)", "language": "zh-TW", "duration_seconds": 10}' >/dev/null
  else
    echo "✗ Failed to set Phase 3 configuration."
    exit 1
  fi

  echo "⏳ Waiting 10 seconds..."
  sleep 10

  # PHASE 4: 16 Grid (4x4)
  echo ""
  echo "➜ PHASE 4: Switching to 16 Grid (4x4)..."
  panels_16=""
  for i in {1..16}; do
    img="offspring_20250929_114732_835.png"
    if [ $((i % 4)) -eq 2 ]; then img="offspring_20250929_112621_888.png"; fi
    if [ $((i % 4)) -eq 3 ]; then img="offspring_20250927_141336_787.png"; fi
    if [ $((i % 4)) -eq 0 ]; then img="offspring_20251001_181913_443.png"; fi
    panels_16="${panels_16}{\"id\": \"p${i}\", \"url\": \"/?slide_mode=true&img=${img}\", \"ratio\": 1},"
  done
  panels_16="${panels_16%,}"
  
  iframe_config_4="$(curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
    -H "Content-Type: application/json" \
    -d "{
      \"target_client_id\": \"${TARGET_CLIENT_ID}\",
      \"layout\": \"grid\",
      \"gap\": 8,
      \"columns\": 4,
      \"panels\": [${panels_16}]
    }")"
  
  if echo "${iframe_config_4}" | jq -e '.panels[0]' >/dev/null 2>&1; then
    echo "✓ Phase 4 configured - 16 Grid"
    curl -fsS -X POST "${API_BASE}/api/subtitles?target_client_id=${TARGET_CLIENT_ID}" \
      -H "Content-Type: application/json" \
      -d '{"text": "🔲 16 格 布局 (4x4)", "language": "zh-TW", "duration_seconds": 10}' >/dev/null
  else
    echo "✗ Failed to set Phase 4 configuration."
    exit 1
  fi

  echo "⏳ Waiting 10 seconds..."
  sleep 10

  # PHASE 5: 25 Grid (5x5)
  echo ""
  echo "➜ PHASE 5: Switching to 25 Grid (5x5)..."
  panels_25=""
  for i in {1..25}; do
    img="offspring_20250929_114732_835.png"
    if [ $((i % 4)) -eq 2 ]; then img="offspring_20250929_112621_888.png"; fi
    if [ $((i % 4)) -eq 3 ]; then img="offspring_20250927_141336_787.png"; fi
    if [ $((i % 4)) -eq 0 ]; then img="offspring_20251001_181913_443.png"; fi
    panels_25="${panels_25}{\"id\": \"p${i}\", \"url\": \"/?slide_mode=true&img=${img}\", \"ratio\": 1},"
  done
  panels_25="${panels_25%,}"
  
  iframe_config_5="$(curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
    -H "Content-Type: application/json" \
    -d "{
      \"target_client_id\": \"${TARGET_CLIENT_ID}\",
      \"layout\": \"grid\",
      \"gap\": 6,
      \"columns\": 5,
      \"panels\": [${panels_25}]
    }")"
  
  if echo "${iframe_config_5}" | jq -e '.panels[0]' >/dev/null 2>&1; then
    echo "✓ Phase 5 configured - 25 Grid"
    curl -fsS -X POST "${API_BASE}/api/subtitles?target_client_id=${TARGET_CLIENT_ID}" \
      -H "Content-Type: application/json" \
      -d '{"text": "🔲 25 格 布局 (5x5)", "language": "zh-TW", "duration_seconds": 10}' >/dev/null
  else
    echo "✗ Failed to set Phase 5 configuration."
    exit 1
  fi

  echo "⏳ Waiting 10 seconds..."
  sleep 10

  # PHASE 6: 100 Grid (10x10)
  echo ""
  echo "➜ PHASE 6: Switching to 100 Grid (10x10)..."
  panels_100=""
  for i in {1..100}; do
    img="offspring_20250929_114732_835.png"
    if [ $((i % 4)) -eq 2 ]; then img="offspring_20250929_112621_888.png"; fi
    if [ $((i % 4)) -eq 3 ]; then img="offspring_20250927_141336_787.png"; fi
    if [ $((i % 4)) -eq 0 ]; then img="offspring_20251001_181913_443.png"; fi
    panels_100="${panels_100}{\"id\": \"p${i}\", \"url\": \"/?slide_mode=true&img=${img}\", \"ratio\": 1},"
  done
  panels_100="${panels_100%,}"
  
  iframe_config_6="$(curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
    -H "Content-Type: application/json" \
    -d "{
      \"target_client_id\": \"${TARGET_CLIENT_ID}\",
      \"layout\": \"grid\",
      \"gap\": 4,
      \"columns\": 10,
      \"panels\": [${panels_100}]
    }")"
  
  if echo "${iframe_config_6}" | jq -e '.panels[0]' >/dev/null 2>&1; then
    echo "✓ Phase 6 configured - 100 Grid (FINAL)"
    curl -fsS -X POST "${API_BASE}/api/subtitles?target_client_id=${TARGET_CLIENT_ID}" \
      -H "Content-Type: application/json" \
      -d '{"text": "🔲 100 格 布局 (10x10) - 完成！", "language": "zh-TW", "duration_seconds": 10}' >/dev/null
    echo "${iframe_config_6}" | jq '.panels | length'
    exit 0
  else
    echo "✗ Failed to set Phase 6 configuration."
    exit 1
  fi
else
  echo "✗ Client '${TARGET_CLIENT_ID}' is not connected."
  echo "Server response:"
  echo "${clients_json}"
  exit 1
fi
