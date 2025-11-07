#!/usr/bin/env bash

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"
TARGET_CLIENT_ID="${TARGET_CLIENT_ID:-integration_test}"

# Helper function to set subtitle
set_subtitle() {
  local text="$1"
  local duration="${2:-10}"
  local payload
  payload="$(
    jq -n \
      --arg text "${text}" \
      --arg lang "zh-TW" \
      --argjson duration "${duration}" \
      '{text: $text, language: $lang, duration_seconds: $duration}'
  )"
  local response
  if ! response="$(curl -fsS -X POST "${API_BASE}/api/subtitles?target_client_id=${TARGET_CLIENT_ID}" \
    -H "Content-Type: application/json" \
    -d "${payload}")"; then
    echo "✗ Failed to set subtitle: ${text}" >&2
    exit 1
  fi

  if ! echo "${response}" | jq -e '.subtitle' >/dev/null 2>&1; then
    echo "✗ Subtitle API returned unexpected response: ${response}" >&2
    exit 1
  fi

  echo "✓ Subtitle set: ${text}"
}

# Helper function to set collage config
set_collage_config() {
  local client_id="$1"
  local config_json="$2"
  local response
  if ! response="$(curl -fsS -X PUT "${API_BASE}/api/collage-config" \
    -H "Content-Type: application/json" \
    -d "${config_json}")"; then
    echo "✗ Failed to set collage config for ${client_id}" >&2
    exit 1
  fi
  if ! echo "${response}" | jq -e '.config' >/dev/null 2>&1; then
    echo "✗ Collage config API returned unexpected response: ${response}" >&2
    exit 1
  fi
  echo "✓ Collage config set for ${client_id}"
}

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: 'jq' is required but not found in PATH." >&2
  exit 2
fi

echo "=== Collage Mode 測試 ==="
echo "➜ Checking whether client '${TARGET_CLIENT_ID}' is connected..."

clients_json="$(curl -fsS "${API_BASE}/api/clients")"

if echo "${clients_json}" | jq -e --arg client "${TARGET_CLIENT_ID}" '.clients | any(.client_id == $client and .connections > 0)' >/dev/null; then
  echo "✓ Client '${TARGET_CLIENT_ID}' is connected."
  
  # 準備單格測試用的 client ID
  CLIENT_SINGLE="${TARGET_CLIENT_ID}_single"
  
  # 準備四個不同的 client ID 用於最後的四格壓力測試
  CLIENT_WORLD1="${TARGET_CLIENT_ID}_world1"
  CLIENT_WORLD2="${TARGET_CLIENT_ID}_world2"
  CLIENT_WORLD3="${TARGET_CLIENT_ID}_world3"
  CLIENT_WORLD4="${TARGET_CLIENT_ID}_world4"
  
  # 準備圖片列表（最多10張）
  IMG1="offspring_20250923_163256_169.png"
  IMG2="offspring_20250923_170818_939.png"
  IMG3="offspring_20250923_172041_821.png"
  IMG4="offspring_20250924_003058_044.png"
  IMG5="offspring_20250923_161828_524.png"
  IMG6="offspring_20250923_185648_952.png"
  IMG7="offspring_20250923_190344_658.png"
  IMG8="offspring_20250929_114732_835.png"
  IMG9="offspring_20250929_114940_017.png"
  IMG10="offspring_20250927_141336_787.png"
  
  echo ""
  echo "=== Phase 1: 單格基礎測試 (50x50 = 2500片) ==="
  set_subtitle "🧩 單格基礎測試 - 50x50 網格，單張圖片分解" 12
  
  # 設定單格 iframe
  echo "➜ Setting up single-panel iframe..."
  iframe_config="$(curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
    -H "Content-Type: application/json" \
    -d "{
      \"target_client_id\": \"${TARGET_CLIENT_ID}\",
      \"layout\": \"grid\",
      \"gap\": 12,
      \"columns\": 1,
      \"panels\": [
        {
          \"id\": \"single\",
          \"url\": \"/?client=${CLIENT_SINGLE}&collage_mode=true&img=${IMG1}\",
          \"ratio\": 1,
          \"label\": \"單格測試\"
        }
      ]
    }")"
  
  if ! echo "${iframe_config}" | jq -e '.panels[0]' >/dev/null 2>&1; then
    echo "✗ Failed to configure iframe."
    exit 1
  fi
  
  echo "✓ Single-panel iframe configured"
  
  # 設定 collage config
  config_json="$(jq -n \
    --arg client_id "${CLIENT_SINGLE}" \
    --arg img "${IMG1}" \
    '{
      target_client_id: $client_id,
      images: [$img],
      image_count: 1,
      rows: 50,
      cols: 50,
      mix: true,
      stage_width: 1920,
      stage_height: 1080,
      seed: 100
    }')"
  
  set_collage_config "${CLIENT_SINGLE}" "${config_json}"
  echo "⏳ Displaying single-panel (50x50 = 2500 pieces) for 8 seconds..."
  sleep 8
  
  echo ""
  echo "=== Phase 2: 測試不同網格大小 (單格) ==="
  set_subtitle "📐 測試不同網格大小 (30x30, 40x40, 50x50, 60x60)" 30
  
  for grid_size in 30 40 50 60; do
    pieces=$((grid_size * grid_size))
    echo "➜ Setting grid size to ${grid_size}x${grid_size} (${pieces} pieces)..."
    
    config_json="$(jq -n \
      --arg client_id "${CLIENT_SINGLE}" \
      --arg img "${IMG1}" \
      --argjson size "${grid_size}" \
      '{
        target_client_id: $client_id,
        images: [$img],
        image_count: 1,
        rows: $size,
        cols: $size,
        mix: true,
        stage_width: 1920,
        stage_height: 1080,
        seed: 100
      }')"
    
    set_collage_config "${CLIENT_SINGLE}" "${config_json}"
    echo "⏳ Displaying ${grid_size}x${grid_size} grid (${pieces} pieces) for 8 seconds (allowing animation to complete)..."
    sleep 8
  done
  
  echo ""
  echo "=== Phase 3: 測試混合模式開關 (單格) ==="
  set_subtitle "🔄 測試混合模式 (mix=true vs mix=false)" 20
  
  # 先顯示 mix=false
  echo "➜ Setting mix=false (no mixing)..."
  config_json="$(jq -n \
    --arg client_id "${CLIENT_SINGLE}" \
    --arg img "${IMG1}" \
    '{
      target_client_id: $client_id,
      images: [$img],
      image_count: 1,
      rows: 50,
      cols: 50,
      mix: false,
      stage_width: 1920,
      stage_height: 1080,
      seed: 100
    }')"
  
  set_collage_config "${CLIENT_SINGLE}" "${config_json}"
  echo "⏳ Displaying mix=false for 8 seconds (allowing animation to complete)..."
  sleep 8
  
  # 再顯示 mix=true
  echo "➜ Setting mix=true (with mixing)..."
  config_json="$(jq -n \
    --arg client_id "${CLIENT_SINGLE}" \
    --arg img "${IMG1}" \
    '{
      target_client_id: $client_id,
      images: [$img],
      image_count: 1,
      rows: 50,
      cols: 50,
      mix: true,
      stage_width: 1920,
      stage_height: 1080,
      seed: 100
    }')"
  
  set_collage_config "${CLIENT_SINGLE}" "${config_json}"
  echo "⏳ Displaying mix=true for 8 seconds (allowing animation to complete)..."
  sleep 8
  
  echo ""
  echo "=== Phase 4: 測試多張圖片混合 (單格, 最多10張) ==="
  set_subtitle "🎨 測試多張圖片混合 (2張 → 5張 → 10張)" 30
  
  # 測試 2 張圖片
  echo "➜ Testing with 2 images..."
  config_json="$(jq -n \
    --arg client_id "${CLIENT_SINGLE}" \
    --arg img1 "${IMG1}" \
    --arg img2 "${IMG2}" \
    '{
      target_client_id: $client_id,
      images: [$img1, $img2],
      image_count: 2,
      rows: 50,
      cols: 50,
      mix: true,
      stage_width: 1920,
      stage_height: 1080,
      seed: 100
    }')"
  
  set_collage_config "${CLIENT_SINGLE}" "${config_json}"
  echo "⏳ Displaying 2-image mix for 8 seconds (allowing animation to complete)..."
  sleep 8
  
  # 測試 5 張圖片
  echo "➜ Testing with 5 images..."
  config_json="$(jq -n \
    --arg client_id "${CLIENT_SINGLE}" \
    --arg img1 "${IMG1}" \
    --arg img2 "${IMG2}" \
    --arg img3 "${IMG3}" \
    --arg img4 "${IMG4}" \
    --arg img5 "${IMG5}" \
    '{
      target_client_id: $client_id,
      images: [$img1, $img2, $img3, $img4, $img5],
      image_count: 5,
      rows: 50,
      cols: 50,
      mix: true,
      stage_width: 1920,
      stage_height: 1080,
      seed: 100
    }')"
  
  set_collage_config "${CLIENT_SINGLE}" "${config_json}"
  echo "⏳ Displaying 5-image mix for 8 seconds (allowing animation to complete)..."
  sleep 8
  
  # 測試 10 張圖片（上限）
  echo "➜ Testing with 10 images (maximum)..."
  config_json="$(jq -n \
    --arg client_id "${CLIENT_SINGLE}" \
    --arg img1 "${IMG1}" \
    --arg img2 "${IMG2}" \
    --arg img3 "${IMG3}" \
    --arg img4 "${IMG4}" \
    --arg img5 "${IMG5}" \
    --arg img6 "${IMG6}" \
    --arg img7 "${IMG7}" \
    --arg img8 "${IMG8}" \
    --arg img9 "${IMG9}" \
    --arg img10 "${IMG10}" \
    '{
      target_client_id: $client_id,
      images: [$img1, $img2, $img3, $img4, $img5, $img6, $img7, $img8, $img9, $img10],
      image_count: 10,
      rows: 50,
      cols: 50,
      mix: true,
      stage_width: 1920,
      stage_height: 1080,
      seed: 100
    }')"
  
  set_collage_config "${CLIENT_SINGLE}" "${config_json}"
  echo "⏳ Displaying 10-image mix for 8 seconds (allowing animation to complete)..."
  sleep 8
  
  echo ""
  echo "=== Phase 5: 測試不同 Seed 值 (單格) ==="
  set_subtitle "🎲 測試不同 Seed 值 (相同圖片, 不同排列)" 30
  
  for seed in 100 200 300 400 500; do
    echo "➜ Setting seed=${seed}..."
    config_json="$(jq -n \
      --arg client_id "${CLIENT_SINGLE}" \
      --arg img "${IMG1}" \
      --argjson seed "${seed}" \
      '{
        target_client_id: $client_id,
        images: [$img],
        image_count: 1,
        rows: 50,
        cols: 50,
        mix: true,
        stage_width: 1920,
        stage_height: 1080,
        seed: $seed
      }')"
    
    set_collage_config "${CLIENT_SINGLE}" "${config_json}"
    echo "⏳ Displaying seed=${seed} for 6 seconds (allowing animation to complete)..."
    sleep 6
  done
  
  echo ""
  echo "=== Phase 6: 壓力測試 - 四格平行世界 (總共約6000片) ==="
  set_subtitle "💪 壓力測試 - 四格平行世界，每個約38x38 (總共約6000片)" 20
  
  # 計算：6000片 / 4格 = 1500片/格，sqrt(1500) ≈ 38.7，使用 39x39 = 1521片/格，總共約6084片
  PRESSURE_GRID_SIZE=39
  PIECES_PER_PANEL=$((PRESSURE_GRID_SIZE * PRESSURE_GRID_SIZE))
  TOTAL_PIECES=$((PIECES_PER_PANEL * 4))
  
  echo "➜ Setting up 4-panel stress test..."
  echo "   Grid size: ${PRESSURE_GRID_SIZE}x${PRESSURE_GRID_SIZE} per panel"
  echo "   Pieces per panel: ${PIECES_PER_PANEL}"
  echo "   Total pieces: ${TOTAL_PIECES}"
  
  # 設定四個世界的 collage config
  for i in 1 2 3 4; do
    client_var="CLIENT_WORLD${i}"
    img_var="IMG${i}"
    client_id="${!client_var}"
    img="${!img_var}"
    
    config_json="$(jq -n \
      --arg client_id "${client_id}" \
      --arg img "${img}" \
      --argjson seed $((i * 100)) \
      --argjson size "${PRESSURE_GRID_SIZE}" \
      '{
        target_client_id: $client_id,
        images: [$img],
        image_count: 1,
        rows: $size,
        cols: $size,
        mix: true,
        stage_width: 1920,
        stage_height: 1080,
        seed: $seed
      }')"
    
    set_collage_config "${client_id}" "${config_json}"
  done
  
  # 設定 iframe config 顯示四個平行世界
  echo "➜ Setting up 4-panel iframe layout..."
  iframe_config="$(curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
    -H "Content-Type: application/json" \
    -d "{
      \"target_client_id\": \"${TARGET_CLIENT_ID}\",
      \"layout\": \"horizontal\",
      \"gap\": 12,
      \"columns\": 4,
      \"panels\": [
        {
          \"id\": \"world1\",
          \"url\": \"/?client=${CLIENT_WORLD1}&collage_mode=true&img=${IMG1}\",
          \"ratio\": 1,
          \"label\": \"平行世界 1\"
        },
        {
          \"id\": \"world2\",
          \"url\": \"/?client=${CLIENT_WORLD2}&collage_mode=true&img=${IMG2}\",
          \"ratio\": 1,
          \"label\": \"平行世界 2\"
        },
        {
          \"id\": \"world3\",
          \"url\": \"/?client=${CLIENT_WORLD3}&collage_mode=true&img=${IMG3}\",
          \"ratio\": 1,
          \"label\": \"平行世界 3\"
        },
        {
          \"id\": \"world4\",
          \"url\": \"/?client=${CLIENT_WORLD4}&collage_mode=true&img=${IMG4}\",
          \"ratio\": 1,
          \"label\": \"平行世界 4\"
        }
      ]
    }")"
  
  if echo "${iframe_config}" | jq -e '.panels[0]' >/dev/null 2>&1; then
    panel_count=$(echo "${iframe_config}" | jq '.panels | length')
    echo "✓ Iframe configured with ${panel_count} panels"
    echo "⏳ Stress test: Displaying 4-panel collage (${TOTAL_PIECES} total pieces) for 15 seconds..."
    sleep 15
  else
    echo "✗ Failed to configure iframe for stress test."
    exit 1
  fi
  
  echo ""
  echo "=== Test Complete ==="
  echo "✓ All collage mode tests completed successfully!"
  echo ""
  echo "Test Summary:"
  echo "  • Single-panel tests (most phases)"
  echo "  • Grid sizes tested: 30x30 to 60x60"
  echo "  • Mix mode toggle (true/false)"
  echo "  • Multiple image mixing (2, 5, 10 images)"
  echo "  • Different seed values (100-500)"
  echo "  • Stress test: 4-panel layout (${TOTAL_PIECES} total pieces)"
  echo ""
  echo "Total pieces in stress test: ${TOTAL_PIECES} (~6000 limit)"
  exit 0
else
  echo "✗ Client '${TARGET_CLIENT_ID}' is not connected."
  echo "Please ensure the frontend is running at http://localhost:5173/?iframe_mode=true&client=${TARGET_CLIENT_ID}"
  echo "Server response:"
  echo "${clients_json}"
  exit 1
fi
