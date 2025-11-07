#!/bin/bash

# 使用不同圖片進行 collage 截圖壓力測試

API_BASE="http://localhost:8000"
CLIENT="desktop_collage"
STAGE_WIDTH=1920
STAGE_HEIGHT=1080

# 獲取圖片列表
IMAGES=($(ls backend/offspring_images/*.png | head -5 | xargs -n1 basename))

echo "=== 使用不同圖片進行壓力測試 ==="
echo ""
echo "選取的圖片："
for img in "${IMAGES[@]}"; do
  echo "  - $img"
done
echo ""

# 測試 1: 3000片
echo "測試 1: ${IMAGES[0]} (3000片, 50×60)"
curl -s -X PUT "$API_BASE/api/collage-config" \
  -H "Content-Type: application/json" \
  -d "{\"target_client_id\": \"$CLIENT\", \"rows\": 50, \"cols\": 60, \"mix\": true, \"image_count\": 1, \"stage_width\": $STAGE_WIDTH, \"stage_height\": $STAGE_HEIGHT, \"images\": [\"${IMAGES[0]}\"]}" > /dev/null
sleep 4
REQUEST_ID=$(curl -s -X POST "$API_BASE/api/screenshots/request?client=desktop" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.id')
echo "  請求 ID: $REQUEST_ID"
sleep 35
LATEST=$(ls -t screen_shots/*.png | head -1)
SIZE=$(stat -f%z "$LATEST" 2>/dev/null || stat -c%s "$LATEST" 2>/dev/null)
echo "  截圖: $(basename $LATEST) - $SIZE bytes"
echo ""

# 測試 2: 4000片
echo "測試 2: ${IMAGES[1]} (4000片, 50×80)"
curl -s -X PUT "$API_BASE/api/collage-config" \
  -H "Content-Type: application/json" \
  -d "{\"target_client_id\": \"$CLIENT\", \"rows\": 50, \"cols\": 80, \"mix\": true, \"image_count\": 1, \"stage_width\": $STAGE_WIDTH, \"stage_height\": $STAGE_HEIGHT, \"images\": [\"${IMAGES[1]}\"]}" > /dev/null
sleep 4
REQUEST_ID=$(curl -s -X POST "$API_BASE/api/screenshots/request?client=desktop" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.id')
echo "  請求 ID: $REQUEST_ID"
sleep 40
LATEST=$(ls -t screen_shots/*.png | head -1)
SIZE=$(stat -f%z "$LATEST" 2>/dev/null || stat -c%s "$LATEST" 2>/dev/null)
echo "  截圖: $(basename $LATEST) - $SIZE bytes"
echo ""

# 測試 3: 5000片
echo "測試 3: ${IMAGES[2]} (5000片, 50×100)"
curl -s -X PUT "$API_BASE/api/collage-config" \
  -H "Content-Type: application/json" \
  -d "{\"target_client_id\": \"$CLIENT\", \"rows\": 50, \"cols\": 100, \"mix\": true, \"image_count\": 1, \"stage_width\": $STAGE_WIDTH, \"stage_height\": $STAGE_HEIGHT, \"images\": [\"${IMAGES[2]}\"]}" > /dev/null
sleep 4
REQUEST_ID=$(curl -s -X POST "$API_BASE/api/screenshots/request?client=desktop" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.id')
echo "  請求 ID: $REQUEST_ID"
sleep 50
LATEST=$(ls -t screen_shots/*.png | head -1)
SIZE=$(stat -f%z "$LATEST" 2>/dev/null || stat -c%s "$LATEST" 2>/dev/null)
echo "  截圖: $(basename $LATEST) - $SIZE bytes"
echo ""

# 測試 4: 3000片（不同圖片）
echo "測試 4: ${IMAGES[3]} (3000片, 50×60)"
curl -s -X PUT "$API_BASE/api/collage-config" \
  -H "Content-Type: application/json" \
  -d "{\"target_client_id\": \"$CLIENT\", \"rows\": 50, \"cols\": 60, \"mix\": true, \"image_count\": 1, \"stage_width\": $STAGE_WIDTH, \"stage_height\": $STAGE_HEIGHT, \"images\": [\"${IMAGES[3]}\"]}" > /dev/null
sleep 4
REQUEST_ID=$(curl -s -X POST "$API_BASE/api/screenshots/request?client=desktop" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.id')
echo "  請求 ID: $REQUEST_ID"
sleep 35
LATEST=$(ls -t screen_shots/*.png | head -1)
SIZE=$(stat -f%z "$LATEST" 2>/dev/null || stat -c%s "$LATEST" 2>/dev/null)
echo "  截圖: $(basename $LATEST) - $SIZE bytes"
echo ""

# 測試 5: 6000片
echo "測試 5: ${IMAGES[4]} (6000片, 60×100)"
curl -s -X PUT "$API_BASE/api/collage-config" \
  -H "Content-Type: application/json" \
  -d "{\"target_client_id\": \"$CLIENT\", \"rows\": 60, \"cols\": 100, \"mix\": true, \"image_count\": 1, \"stage_width\": $STAGE_WIDTH, \"stage_height\": $STAGE_HEIGHT, \"images\": [\"${IMAGES[4]}\"]}" > /dev/null
sleep 4
REQUEST_ID=$(curl -s -X POST "$API_BASE/api/screenshots/request?client=desktop" \
  -H "Content-Type: application/json" \
  -d '{}' | jq -r '.id')
echo "  請求 ID: $REQUEST_ID"
sleep 60
LATEST=$(ls -t screen_shots/*.png | head -1)
SIZE=$(stat -f%z "$LATEST" 2>/dev/null || stat -c%s "$LATEST" 2>/dev/null)
echo "  截圖: $(basename $LATEST) - $SIZE bytes"
echo ""

echo "=== 測試結果總結 ==="
echo ""
ls -lt screen_shots/*.png | head -5 | awk '{printf "%-60s %10s bytes\n", $9, $5}'
echo ""
echo "判斷標準："
echo "- > 1MB: 成功 ✅"
echo "- < 500KB: 失敗 ❌"

