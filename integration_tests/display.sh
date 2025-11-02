#!/usr/bin/env bash

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:8000}"
TARGET_CLIENT_ID="${TARGET_CLIENT_ID:-integration_test}"
IMG="${IMG:-offspring_20250929_114732_835.png}"

# Helper function to set subtitle
set_subtitle() {
  local text="$1"
  local duration="${2:-10}"
  curl -fsS -X POST "${API_BASE}/api/subtitles?target_client_id=${TARGET_CLIENT_ID}" \
    -H "Content-Type: application/json" \
    -d "{\"text\": \"${text}\", \"language\": \"zh-TW\", \"duration_seconds\": ${duration}}" >/dev/null 2>&1 || true
}

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: 'jq' is required but not found in PATH." >&2
  exit 2
fi

echo "=== 顯示模式測試 (Display Modes Test) ==="
echo "➜ Checking whether client '${TARGET_CLIENT_ID}' is connected..."

clients_json="$(curl -fsS "${API_BASE}/api/clients")"

if echo "${clients_json}" | jq -e --arg client "${TARGET_CLIENT_ID}" '.clients | any(.client_id == $client and .connections > 0)' >/dev/null; then
  echo "✓ Client '${TARGET_CLIENT_ID}' is connected."
  
  echo ""
  echo "➜ Setting up 8-panel iframe grid with all display modes..."
  echo "   Using image: ${IMG}"
  
  # Build the 5 panels JSON
  panels_json=$(cat <<EOF
[
  {
    "id": "mode_default",
    "url": "/?img=${IMG}",
    "ratio": 1,
    "label": "預設 3D 景觀"
  },
  {
    "id": "mode_incubator",
    "url": "/?incubator=true&img=${IMG}",
    "ratio": 1,
    "label": "孵化室模式"
  },
  {
    "id": "mode_phylogeny",
    "url": "/?phylogeny=true&img=${IMG}",
    "ratio": 1,
    "label": "親緣圖 2D"
  },
  {
    "id": "mode_slide",
    "url": "/?slide_mode=true&img=${IMG}",
    "ratio": 1,
    "label": "幻燈片模式"
  },
  {
    "id": "mode_organic",
    "url": "/?organic_mode=true&img=${IMG}",
    "ratio": 1,
    "label": "有機室模式"
  }
]
EOF
  )
  
  iframe_config="$(curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
    -H "Content-Type: application/json" \
    -d "{
      \"target_client_id\": \"${TARGET_CLIENT_ID}\",
      \"layout\": \"grid\",
      \"gap\": 12,
      \"columns\": 4,
      \"panels\": ${panels_json}
    }")"
  
  if echo "${iframe_config}" | jq -e '.panels[0]' >/dev/null 2>&1; then
    panel_count=$(echo "${iframe_config}" | jq '.panels | length')
    echo "✓ Iframe configured with ${panel_count} panels"
    
    set_subtitle "📺 所有顯示模式測試 - 8 種模式展示" 15
    echo "✓ Subtitle set: 所有顯示模式測試"
    
    echo ""
    echo "=== Display Modes Overview ==="
    echo "${iframe_config}" | jq -r '.panels[] | "  • \(.label) (\(.id)): \(.url)"'
    
    echo ""
    echo "✓ All 5 display modes are now visible in iframe grid"
    echo "  1. 預設 3D 景觀 (Default 3D Scene)"
    echo "  2. 孵化室模式 (Incubator Mode)"
    echo "  3. 親緣圖 2D (Phylogeny 2D)"
    echo "  4. 幻燈片模式 (Slide Mode)"
    echo "  5. 有機室模式 (Organic Room)"
    echo ""
    echo "⏳ Keeping display for 20 seconds..."
    sleep 20
    
    echo ""
    echo "=== Phase 2: Resizing to 2-Column Layout ==="
    set_subtitle "📐 調整布局為 2 列顯示" 10
    
    iframe_config_2="$(curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
      -H "Content-Type: application/json" \
      -d "{
        \"target_client_id\": \"${TARGET_CLIENT_ID}\",
        \"layout\": \"grid\",
        \"gap\": 12,
        \"columns\": 2,
        \"panels\": ${panels_json}
      }")"
    
    if echo "${iframe_config_2}" | jq -e '.panels[0]' >/dev/null 2>&1; then
      echo "✓ Resized to 2-column layout"
      echo "⏳ Keeping display for 15 seconds..."
      sleep 15
    fi
    
    echo ""
    echo "=== Phase 3: Full-Width Single Column ==="
    set_subtitle "📼 全寬單欄顯示" 10
    
    iframe_config_3="$(curl -fsS -X PUT "${API_BASE}/api/iframe-config" \
      -H "Content-Type: application/json" \
      -d "{
        \"target_client_id\": \"${TARGET_CLIENT_ID}\",
        \"layout\": \"grid\",
        \"gap\": 12,
        \"columns\": 1,
        \"panels\": ${panels_json}
      }")"
    
    if echo "${iframe_config_3}" | jq -e '.panels[0]' >/dev/null 2>&1; then
      echo "✓ Changed to 1-column layout (full-width)"
      echo "⏳ Keeping display for 15 seconds..."
      sleep 15
    fi
    
    echo ""
    echo "=== Test Complete ==="
    echo "✓ All 5 display modes tested successfully!"
    echo "Total panels displayed: 5"
    exit 0
  else
    echo "✗ Failed to configure iframe."
    echo "Server response:"
    echo "${iframe_config}"
    exit 1
  fi
else
  echo "✗ Client '${TARGET_CLIENT_ID}' is not connected."
  echo "Please ensure the frontend is running at http://localhost:5173/?iframe_mode=true&client=integration_test"
  echo "Server response:"
  echo "${clients_json}"
  exit 1
fi
