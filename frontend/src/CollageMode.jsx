import React, { useEffect, useMemo, useRef, useState } from "react";
import "./CollageMode.css";
import { fetchKinship } from "./api.js";
import { ensureHtml2Canvas } from "./utils/html2canvasLoader.js";

const DEFAULT_IMAGE_COUNT = 4;
const DEFAULT_ROWS = 3;
const DEFAULT_COLS = 3;
const MAX_IMAGES = 30;
const MAX_ROWS = 96;
const MAX_COLS = 96;
const DEFAULT_STAGE_WIDTH = 960;
const STAGE_MIN_WIDTH = 360;
const STAGE_MAX_WIDTH = 3840;
const STAGE_MIN_HEIGHT = 240;
const STAGE_MAX_HEIGHT = 2160;
const DEFAULT_STAGE_HEIGHT = 540;
const PIECE_OVERLAP_PX = 1;
const PERSIST_COLLAGE_QUERY =
  String(import.meta.env.VITE_COLLAGE_PERSIST_QUERY ?? "false").trim().toLowerCase() === "true";
const RATIO_MIN = STAGE_MIN_HEIGHT / STAGE_MAX_WIDTH;
const RATIO_MAX = STAGE_MAX_HEIGHT / STAGE_MIN_WIDTH;

const cleanId = (value) => (value ? value.replace(/:(en|zh)$/, "") : value);

const clamp = (value, min, max) => {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const readInitialParam = (key, fallback, min, max) => {
  if (typeof window === "undefined") return fallback;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return clamp(parsed, min, max);
};

const readInitialBooleanParam = (key, fallback) => {
  if (typeof window === "undefined") return fallback;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(key);
  if (!raw) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const buildImagePool = (payload, fallback) => {
  const list = [];
  const seen = new Set();
  const push = (value) => {
    const clean = cleanId(value);
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    list.push(clean);
  };

  if (payload) {
    push(payload.original_image || fallback);
    const buckets = [
      payload.children,
      payload.siblings,
      payload.parents,
      payload.ancestors,
      payload.related_images,
    ];
    (payload.ancestors_by_level || []).forEach((level) => buckets.push(level));
    buckets.forEach((bucket) => (bucket || []).forEach((item) => push(item)));
  } else {
    push(fallback);
  }

  return list;
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let result = Math.imul(t ^ (t >>> 15), 1 | t);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

const buildPieces = (images, rows, cols, seed) => {
  if (!rows || !cols) return [];
  const pieces = [];
  images.forEach((imageId, imageIndex) => {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const pieceSeed = seed + imageIndex * 997 + row * 37 + col * 17;
        const rand = mulberry32(pieceSeed);
        const fromX = (rand() - 0.5) * 260;
        const fromY = (rand() - 0.5) * 200;
        const fromRot = (rand() - 0.5) * 40;
        const delay = (row + col) * 0.08 + rand() * 0.25;
        pieces.push({
          key: `${imageId}-${row}-${col}`,
          imageId,
          imageIndex,
          row,
          col,
          sourceRow: row,
          sourceCol: col,
          fromX,
          fromY,
          fromRot,
          delay,
        });
      }
    }
  });
  return pieces;
};

const buildImageUrl = (base, imageId) => {
  if (!imageId) return "";
  if (!base) return imageId;
  return base.endsWith("/") ? `${base}${imageId}` : `${base}/${imageId}`;
};

const computeStageWidthBounds = (ratio) => {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return { min: STAGE_MIN_WIDTH, max: STAGE_MAX_WIDTH };
  }
  const minWidthCandidate = STAGE_MIN_HEIGHT / ratio;
  const maxWidthCandidate = STAGE_MAX_HEIGHT / ratio;
  let minWidth = Math.max(STAGE_MIN_WIDTH, Math.min(minWidthCandidate, STAGE_MAX_WIDTH));
  let maxWidth = Math.min(STAGE_MAX_WIDTH, Math.max(maxWidthCandidate, STAGE_MIN_WIDTH));
  if (minWidth > maxWidth) {
    const fallback = clamp((minWidth + maxWidthCandidate) / 2, STAGE_MIN_WIDTH, STAGE_MAX_WIDTH);
    minWidth = fallback;
    maxWidth = fallback;
  }
  return { min: minWidth, max: maxWidth };
};

const computeBoardLayout = (count, targetRatio) => {
  if (!count || count <= 0) {
    return { rows: 1, cols: 1 };
  }
  const ratio = clamp(Number.isFinite(targetRatio) && targetRatio > 0 ? targetRatio : 1, RATIO_MIN, RATIO_MAX);
  const maxRows = Math.min(count, MAX_ROWS);
  let bestRows = 1;
  let bestCols = count;
  let bestScore = Number.POSITIVE_INFINITY;

  // 統一評分所有候選方案，比較完美匹配和近似匹配
  // 完美匹配有優勢（-0.15 獎勵），但如果比例很差，可能不如比例好的近似匹配
  for (let rowsCandidate = 1; rowsCandidate <= maxRows; rowsCandidate += 1) {
    const colsCandidate = Math.ceil(count / rowsCandidate);
    if (colsCandidate <= 0) continue;
    const totalSlots = rowsCandidate * colsCandidate;
    const candidateRatio = rowsCandidate / colsCandidate;
    const ratioScore = Math.abs(Math.log(candidateRatio) - Math.log(ratio));
    const balancePenalty = Math.abs(rowsCandidate - colsCandidate) / count;
    
    const isPerfectFit = totalSlots === count;
    const extraSlots = totalSlots - count;
    
    // 計算基礎分數
    let baseScore;
    if (isPerfectFit) {
      // 完美匹配：只考慮比例和平衡度
      baseScore = ratioScore + balancePenalty * 0.001;
    } else {
      // 近似匹配：根據空位數量給予懲罰
      // 如果總槽位數 >= count，給予較小的懲罰（可以填充）
      // 如果總槽位數 < count，給予較大的懲罰（會有空缺）
      const extraPenalty = extraSlots > 0 ? extraSlots / count * 0.02 : Math.abs(extraSlots) / count * 0.15;
      baseScore = ratioScore + extraPenalty + balancePenalty * 0.001;
    }
    
    // 完美匹配給予小獎勵（-0.15），但如果比例很差，獎勵不足以彌補
    // 這樣對於 count=5, ratio=1：
    // - 1×5: baseScore ≈ 1.61, score ≈ 1.46
    // - 2×3: baseScore ≈ 0.409, score ≈ 0.409
    // 2×3 會勝出，因為 0.409 < 1.46
    const perfectFitBonus = isPerfectFit ? -0.15 : 0;
    const score = baseScore + perfectFitBonus;
    
    // 簡單選擇分數最好的候選方案
    if (score < bestScore) {
      bestScore = score;
      bestRows = rowsCandidate;
      bestCols = colsCandidate;
    }
  }

  return { rows: Math.max(1, bestRows), cols: Math.max(1, bestCols) };
};

const shuffleWithRng = (array, rng) => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
};

const colorDistance = (a, b) => {
  if (!a || !b) return 255 * 5;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

const edgeKeyForPiece = (piece) => `${piece.imageId}|${piece.sourceRow}|${piece.sourceCol}`;
const EDGE_SAMPLE_CACHE = new Map();
const IMAGE_DIMENSION_CACHE = new Map();

const loadImageElement = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`無法載入圖像 ${url}`));
    img.src = url;
  });

const ensureImageDimensions = (imageUrl) => {
  if (!imageUrl) {
    return Promise.resolve(null);
  }
  const cached = IMAGE_DIMENSION_CACHE.get(imageUrl);
  if (cached) {
    return cached instanceof Promise ? cached : Promise.resolve(cached);
  }
  const promise = loadImageElement(imageUrl)
    .then((img) => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        throw new Error(`圖像尺寸為 0：${imageUrl}`);
      }
      const payload = { width, height, ratio: width / height };
      IMAGE_DIMENSION_CACHE.set(imageUrl, payload);
      return payload;
    })
    .catch((err) => {
      const cachedValue = IMAGE_DIMENSION_CACHE.get(imageUrl);
      if (cachedValue === promise) {
        IMAGE_DIMENSION_CACHE.delete(imageUrl);
      }
      throw err;
    });
  IMAGE_DIMENSION_CACHE.set(imageUrl, promise);
  return promise;
};

const averageRectColor = (data, width, height, startX, startY, rectWidth, rectHeight) => {
  if (!rectWidth || !rectHeight) return [0, 0, 0];
  const stepX = Math.max(1, Math.floor(rectWidth / 6));
  const stepY = Math.max(1, Math.floor(rectHeight / 6));
  let samples = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  const maxX = Math.min(width, startX + rectWidth);
  const maxY = Math.min(height, startY + rectHeight);
  for (let y = startY; y < maxY; y += stepY) {
    for (let x = startX; x < maxX; x += stepX) {
      const idx = (y * width + x) * 4;
      r += data[idx];
      g += data[idx + 1];
      b += data[idx + 2];
      samples += 1;
    }
  }
  if (!samples) return [0, 0, 0];
  return [r / samples, g / samples, b / samples];
};

const computeEdgesForImage = async (imageId, imageUrl, rows, cols) => {
  const cacheKey = `${imageUrl}|${rows}|${cols}`;
  if (EDGE_SAMPLE_CACHE.has(cacheKey)) {
    return EDGE_SAMPLE_CACHE.get(cacheKey);
  }

  const img = await loadImageElement(imageUrl);
  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;
  if (!sourceWidth || !sourceHeight) {
    throw new Error(`圖像尺寸為 0：${imageUrl}`);
  }

  const pieceSourceWidth = sourceWidth / cols;
  const pieceSourceHeight = sourceHeight / rows;

  const workCanvas = document.createElement("canvas");
  const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });

  const result = new Map();

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const key = `${imageId}|${row}|${col}`;
      const sourceX = col * pieceSourceWidth;
      const sourceY = row * pieceSourceHeight;
      const drawWidth = Math.max(1, Math.round(pieceSourceWidth));
      const drawHeight = Math.max(1, Math.round(pieceSourceHeight));

      workCanvas.width = drawWidth;
      workCanvas.height = drawHeight;
      workCtx.clearRect(0, 0, drawWidth, drawHeight);
      workCtx.drawImage(img, sourceX, sourceY, pieceSourceWidth, pieceSourceHeight, 0, 0, drawWidth, drawHeight);

      const imageData = workCtx.getImageData(0, 0, drawWidth, drawHeight);
      const data = imageData.data;

      const stripWidth = Math.max(1, Math.round(drawWidth * 0.12));
      const stripHeight = Math.max(1, Math.round(drawHeight * 0.12));
      const centerWidth = Math.max(1, Math.round(drawWidth * 0.5));
      const centerHeight = Math.max(1, Math.round(drawHeight * 0.5));
      const centerStartX = Math.max(0, Math.round((drawWidth - centerWidth) / 2));
      const centerStartY = Math.max(0, Math.round((drawHeight - centerHeight) / 2));

      result.set(key, {
        top: averageRectColor(data, drawWidth, drawHeight, 0, 0, drawWidth, stripHeight),
        bottom: averageRectColor(
          data,
          drawWidth,
          drawHeight,
          0,
          Math.max(0, drawHeight - stripHeight),
          drawWidth,
          stripHeight,
        ),
        left: averageRectColor(data, drawWidth, drawHeight, 0, 0, stripWidth, drawHeight),
        right: averageRectColor(
          data,
          drawWidth,
          drawHeight,
          Math.max(0, drawWidth - stripWidth),
          0,
          stripWidth,
          drawHeight,
        ),
        center: averageRectColor(data, drawWidth, drawHeight, centerStartX, centerStartY, centerWidth, centerHeight),
      });
    }
  }

  EDGE_SAMPLE_CACHE.set(cacheKey, result);
  return result;
};

const buildRandomMixedPieces = (pieces, rows, cols, seed) => {
  if (!pieces.length || !rows || !cols) return [];
  const totalSlots = rows * cols;
  const slots = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      slots.push({ row, col });
    }
  }

  const baseSeed = seed ^ (rows << 7) ^ (cols << 11) ^ pieces.length;
  const rand = mulberry32(baseSeed);
  const shuffledSlots = shuffleWithRng(slots, rand);
  const shuffledPieces = shuffleWithRng(
    pieces.map((piece) => ({ ...piece })),
    mulberry32(baseSeed ^ 0x9e3779b1),
  );

  // 確保填充所有位置：如果片段少於槽位，重複使用片段
  const result = [];
  for (let i = 0; i < totalSlots; i += 1) {
    const slot = shuffledSlots[i];
    const pieceIndex = i % shuffledPieces.length;
    const piece = shuffledPieces[pieceIndex];
    result.push({
      ...piece,
      row: slot.row,
      col: slot.col,
      key: `${slot.row}-${slot.col}-${piece.key}-${i}`,
    });
  }
  return result;
};

const buildEdgeAwareMixedPieces = (pieces, rows, cols, seed, edgeLookup) => {
  if (!pieces.length || !rows || !cols) return [];
  const capacity = rows * cols;
  // 確保填充所有位置：如果片段少於槽位，準備重複使用的片段池
  const piecesPool = [];
  while (piecesPool.length < capacity) {
    piecesPool.push(...pieces.map((piece) => ({ ...piece })));
  }
  const availablePieces = piecesPool.slice(0, capacity);

  const rand = mulberry32(seed ^ 0xabcdef);
  const available = availablePieces.map((piece) => ({ piece }));
  const placedMatrix = Array.from({ length: rows }, () => Array(cols).fill(null));

  const slotOrder = Array.from({ length: capacity }, (_, index) => ({
    row: Math.floor(index / cols),
    col: index % cols,
  }));

  slotOrder.forEach(({ row, col }) => {
    let bestIdx = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < available.length; i += 1) {
      const candidate = available[i].piece;
      const candidateEdges = edgeLookup.get(edgeKeyForPiece(candidate));
      if (!candidateEdges) continue;

      let score = 0;
      let matches = 0;

      if (col > 0 && placedMatrix[row][col - 1]) {
        const neighbor = placedMatrix[row][col - 1];
        const neighborEdges = edgeLookup.get(edgeKeyForPiece(neighbor));
        if (neighborEdges) {
          score += colorDistance(neighborEdges.right, candidateEdges.left);
          matches += 1;
        }
      }

      if (row > 0 && placedMatrix[row - 1][col]) {
        const neighbor = placedMatrix[row - 1][col];
        const neighborEdges = edgeLookup.get(edgeKeyForPiece(neighbor));
        if (neighborEdges) {
          score += colorDistance(neighborEdges.bottom, candidateEdges.top);
          matches += 1;
        }
      }

      if (matches === 0) {
        score = colorDistance(candidateEdges.center, [128, 128, 128]) + rand() * 5;
      } else {
        score = score / matches + rand() * 0.1;
      }

      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }

    let chosen;
    if (bestIdx < 0) {
      const fallbackIdx = Math.floor(rand() * available.length);
      chosen = available.splice(fallbackIdx, 1)[0].piece;
    } else {
      chosen = available.splice(bestIdx, 1)[0].piece;
    }

    placedMatrix[row][col] = chosen;
  });

  optimizeBottomRightPlacement(placedMatrix, rows, cols, edgeLookup);

  const results = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const chosen = placedMatrix[row][col];
      if (!chosen) continue;
      results.push({
        ...chosen,
        row,
        col,
        key: `${row}-${col}-${chosen.key}-${row * cols + col}`,
      });
    }
  }

  return results;
};

const evaluateSlotScore = (matrix, row, col, rows, cols, edgeLookup) => {
  const piece = matrix[row][col];
  if (!piece) return Number.POSITIVE_INFINITY;
  const edges = edgeLookup.get(edgeKeyForPiece(piece));
  if (!edges) return Number.POSITIVE_INFINITY;

  let total = 0;
  let matches = 0;

  const accumulate = (neighborRow, neighborCol, selfEdgeKey, neighborEdgeKey) => {
    const neighbor = matrix[neighborRow][neighborCol];
    if (!neighbor) return;
    const neighborEdges = edgeLookup.get(edgeKeyForPiece(neighbor));
    if (!neighborEdges) return;
    total += colorDistance(edges[selfEdgeKey], neighborEdges[neighborEdgeKey]);
    matches += 1;
  };

  if (col > 0) accumulate(row, col - 1, "left", "right");
  if (col < cols - 1) accumulate(row, col + 1, "right", "left");
  if (row > 0) accumulate(row - 1, col, "top", "bottom");
  if (row < rows - 1) accumulate(row + 1, col, "bottom", "top");

  if (!matches) return 0;
  return total / matches;
};

const optimizeBottomRightPlacement = (matrix, rows, cols, edgeLookup) => {
  if (!rows || !cols) return;
  const targetRow = rows - 1;
  const targetCol = cols - 1;

  const gatherPositions = (row, col) => {
    const positions = [[row, col]];
    if (col > 0) positions.push([row, col - 1]);
    if (col < cols - 1) positions.push([row, col + 1]);
    if (row > 0) positions.push([row - 1, col]);
    if (row < rows - 1) positions.push([row + 1, col]);
    return positions;
  };

  const unionPositions = (positionsA, positionsB) => {
    const seen = new Set();
    const merged = [];
    [...positionsA, ...positionsB].forEach(([row, col]) => {
      const key = `${row}:${col}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push([row, col]);
    });
    return merged;
  };

  const regionScore = (positions) => {
    let sum = 0;
    for (let i = 0; i < positions.length; i += 1) {
      const [row, col] = positions[i];
      const value = evaluateSlotScore(matrix, row, col, rows, cols, edgeLookup);
      if (!Number.isFinite(value)) {
        return Number.POSITIVE_INFINITY;
      }
      sum += value;
    }
    return sum;
  };

  const targetPositions = gatherPositions(targetRow, targetCol);
  const baseScore = regionScore(targetPositions);
  if (!Number.isFinite(baseScore) || baseScore === 0) {
    return;
  }

  let bestImprovement = 0;
  let bestSwap = null;
  const totalSlots = rows * cols;

  for (let index = 0; index < totalSlots - 1; index += 1) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    if (row === targetRow && col === targetCol) continue;

    const candidatePositions = gatherPositions(row, col);
    const affected = unionPositions(targetPositions, candidatePositions);
    const beforeScore = regionScore(affected);
    if (!Number.isFinite(beforeScore)) continue;

    const targetPiece = matrix[targetRow][targetCol];
    const candidatePiece = matrix[row][col];
    matrix[targetRow][targetCol] = candidatePiece;
    matrix[row][col] = targetPiece;

    const afterScore = regionScore(affected);

    matrix[row][col] = candidatePiece;
    matrix[targetRow][targetCol] = targetPiece;

    if (!Number.isFinite(afterScore)) continue;

    const improvement = beforeScore - afterScore;
    if (improvement > bestImprovement + 0.5) {
      bestImprovement = improvement;
      bestSwap = { row, col };
    }
  }

  if (bestSwap && bestImprovement > 1.5) {
    const { row, col } = bestSwap;
    const targetPiece = matrix[targetRow][targetCol];
    matrix[targetRow][targetCol] = matrix[row][col];
    matrix[row][col] = targetPiece;
  }
};

export default function CollageMode({ imagesBase, anchorImage, onCaptureReady = null }) {
  const rootRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const initialStageWidth = readInitialParam("collage_width", DEFAULT_STAGE_WIDTH, STAGE_MIN_WIDTH, STAGE_MAX_WIDTH);
  const initialStageHeight = readInitialParam(
    "collage_height",
    DEFAULT_STAGE_HEIGHT,
    STAGE_MIN_HEIGHT,
    STAGE_MAX_HEIGHT,
  );
  const initialDesiredRatio = clamp(initialStageHeight / Math.max(initialStageWidth, 1), RATIO_MIN, RATIO_MAX);
  const [imagePool, setImagePool] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [seed, setSeed] = useState(() => Date.now());
  const [imageCount, setImageCount] = useState(() =>
    readInitialParam("collage_images", DEFAULT_IMAGE_COUNT, 1, MAX_IMAGES),
  );
  const [rows, setRows] = useState(() => readInitialParam("collage_rows", DEFAULT_ROWS, 1, MAX_ROWS));
  const [cols, setCols] = useState(() => readInitialParam("collage_cols", DEFAULT_COLS, 1, MAX_COLS));
  const [mixPieces, setMixPieces] = useState(() => readInitialBooleanParam("collage_mix", false));
  const [edgeLookup, setEdgeLookup] = useState(() => new Map());
  const [edgeStatus, setEdgeStatus] = useState("idle");
  const [stageWidth, setStageWidth] = useState(() => initialStageWidth);
  const [desiredRatio, setDesiredRatio] = useState(() => initialDesiredRatio);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [imageMetrics, setImageMetrics] = useState(() => ({}));

  useEffect(() => {
    if (onCaptureReady == null) return undefined;

    const captureScene = async () => {
      const root = rootRef.current;
      if (!root) {
        throw new Error("Collage 模式尚未準備好");
      }
      const html2canvas = await ensureHtml2Canvas();
      const canvas = await html2canvas(root, {
        backgroundColor: "#050508",
        logging: false,
        useCORS: true,
        onclone: (doc) => {
          doc.querySelectorAll(".collage-piece").forEach((el) => {
            el.style.animation = "none";
            el.style.opacity = "1";
            el.style.transform = "none";
          });
        },
      });
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("無法產生拼貼截圖"));
            return;
          }
          resolve(blob);
        }, "image/png");
      });
    };

    onCaptureReady(captureScene);
    return () => {
      onCaptureReady(null);
    };
  }, [onCaptureReady]);

  useEffect(() => {
    let cancelled = false;
    const cleanAnchor = cleanId(anchorImage);

    if (!cleanAnchor) {
      setImagePool([]);
      setError("請在網址加上 ?img=檔名 以啟動拼貼模式。");
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const data = await fetchKinship(cleanAnchor, -1);
        if (cancelled) return;
        const pool = buildImagePool(data, cleanAnchor);
        setImagePool(pool.length ? pool : [cleanAnchor]);
        if (!pool.length) {
          setError("沒有找到關聯圖像，改以原圖拼貼。");
        }
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "載入圖像清單失敗");
        setImagePool(cleanAnchor ? [cleanAnchor] : []);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [anchorImage]);

  const maxSelectableImages = useMemo(() => {
    if (!imagePool.length) return 1;
    return Math.min(MAX_IMAGES, imagePool.length);
  }, [imagePool]);

  const selectedImages = useMemo(() => {
    if (!imagePool.length) return [];
    const limit = Math.min(imageCount, imagePool.length);
    return imagePool.slice(0, limit);
  }, [imagePool, imageCount]);

  const pieces = useMemo(() => buildPieces(selectedImages, rows, cols, seed), [selectedImages, rows, cols, seed]);
  const totalPieces = pieces.length;

  const mixBoard = useMemo(() => {
    if (!mixPieces || !totalPieces) {
      return { rows, cols };
    }
    return computeBoardLayout(totalPieces, desiredRatio);
  }, [mixPieces, totalPieces, desiredRatio, rows, cols]);

  const boardRatio = useMemo(() => {
    if (!mixBoard?.cols) return DEFAULT_STAGE_HEIGHT / DEFAULT_STAGE_WIDTH;
    return mixBoard.rows / mixBoard.cols || DEFAULT_STAGE_HEIGHT / DEFAULT_STAGE_WIDTH;
  }, [mixBoard.rows, mixBoard.cols]);

  const stageWidthBounds = useMemo(() => computeStageWidthBounds(boardRatio), [boardRatio]);
  const stageHeight = useMemo(() => stageWidth * boardRatio, [stageWidth, boardRatio]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const before = params.toString();

    if (!PERSIST_COLLAGE_QUERY) {
      let modified = false;
      params.forEach((_, key) => {
        if (key.startsWith("collage_") && key !== "collage_mode") {
          params.delete(key);
          modified = true;
        }
      });
      if (modified) {
        const next = params.toString();
        window.history.replaceState(null, "", next ? `${url.pathname}?${next}` : url.pathname);
      }
      return;
    }

    const applyParam = (key, value, defaultValue) => {
      if (value === undefined || value === null || String(value) === String(defaultValue)) {
        if (params.has(key)) {
          params.delete(key);
        }
        return;
      }
      params.set(key, String(value));
    };

    applyParam("collage_images", imageCount, DEFAULT_IMAGE_COUNT);
    applyParam("collage_rows", rows, DEFAULT_ROWS);
    applyParam("collage_cols", cols, DEFAULT_COLS);
    applyParam("collage_mix", mixPieces ? "true" : "false", "false");

    if (mixPieces) {
      applyParam("collage_width", Math.round(stageWidth), DEFAULT_STAGE_WIDTH);
      applyParam("collage_height", Math.round(stageHeight), DEFAULT_STAGE_HEIGHT);
    } else {
      if (params.has("collage_width")) params.delete("collage_width");
      if (params.has("collage_height")) params.delete("collage_height");
    }

    const after = params.toString();
    if (after !== before) {
      window.history.replaceState(null, "", after ? `${url.pathname}?${after}` : url.pathname);
    }
  }, [imageCount, rows, cols, mixPieces, stageWidth, stageHeight]);

  const piecesByImage = useMemo(() => {
    const map = new Map();
    pieces.forEach((piece) => {
      if (!map.has(piece.imageId)) {
        map.set(piece.imageId, []);
      }
      map.get(piece.imageId).push(piece);
    });
    return map;
  }, [pieces]);

  useEffect(() => {
    const baseKey = imagesBase ?? "";
    let cancelled = false;
    const missing = selectedImages.filter((imageId) => {
      const metric = imageMetrics[imageId];
      return !metric || metric.base !== baseKey;
    });
    if (!missing.length) {
      return () => {
        cancelled = true;
      };
    }
    missing.forEach((imageId) => {
      const imageUrl = buildImageUrl(imagesBase, imageId);
      ensureImageDimensions(imageUrl)
        .then((dimensions) => {
          if (cancelled || !dimensions) return;
          setImageMetrics((prev) => {
            const nextMetric = prev[imageId];
            if (nextMetric && nextMetric.base === baseKey) {
              return prev;
            }
            return {
              ...prev,
              [imageId]: {
                ...dimensions,
                base: baseKey,
              },
            };
          });
        })
        .catch((err) => {
          console.warn("Collage 圖像尺寸讀取失敗", imageId, err);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedImages, imagesBase, imageMetrics]);

  const edgesReady = useMemo(
    () => pieces.every((piece) => edgeLookup.has(edgeKeyForPiece(piece))),
    [pieces, edgeLookup],
  );

  const mixedPieces = useMemo(() => {
    if (!mixPieces) return [];
    if (edgesReady) {
      return buildEdgeAwareMixedPieces(pieces, mixBoard.rows, mixBoard.cols, seed, edgeLookup);
    }
    return buildRandomMixedPieces(pieces, mixBoard.rows, mixBoard.cols, seed);
  }, [mixPieces, pieces, mixBoard.rows, mixBoard.cols, seed, edgeLookup, edgesReady]);

  useEffect(() => {
    let changed = false;
    setImageCount((prev) => {
      const next = clamp(prev, 1, maxSelectableImages);
      if (next !== prev) {
        changed = true;
      }
      return next;
    });
    if (changed) {
      setSeed(Date.now());
    }
  }, [maxSelectableImages]);

  useEffect(() => {
    setStageWidth((prev) => {
      const clamped = clamp(prev, stageWidthBounds.min, stageWidthBounds.max);
      if (Math.abs(clamped - prev) < 0.5) {
        return prev;
      }
      return clamped;
    });
  }, [stageWidthBounds]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.ctrlKey && (event.key === "r" || event.key === "R")) {
        event.preventDefault();
        setControlsVisible((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!mixPieces) {
      setEdgeLookup(new Map());
      setEdgeStatus("idle");
      return undefined;
    }
    let cancelled = false;
    setEdgeStatus("loading");
    const run = async () => {
      try {
        const aggregate = new Map();
        await Promise.all(
          selectedImages.map(async (imageId) => {
            const imageUrl = buildImageUrl(imagesBase, imageId);
            const map = await computeEdgesForImage(imageId, imageUrl, rows, cols);
            map.forEach((value, key) => {
              aggregate.set(key, value);
            });
          }),
        );
        if (!cancelled) {
          setEdgeLookup(aggregate);
          setEdgeStatus("ready");
        }
      } catch (err) {
        console.warn("Collage 邊緣分析失敗", err);
        if (!cancelled) {
          setEdgeLookup(new Map());
          setEdgeStatus("failed");
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [mixPieces, selectedImages, rows, cols, imagesBase]);

  const handleImageCountChange = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    setImageCount(clamp(parsed, 1, maxSelectableImages));
    setSeed(Date.now());
  };

  const handleRowsChange = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    setRows(clamp(parsed, 1, MAX_ROWS));
    setSeed(Date.now());
  };

  const handleColsChange = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return;
    setCols(clamp(parsed, 1, MAX_COLS));
    setSeed(Date.now());
  };

  const toggleMixPieces = () => {
    setMixPieces((prev) => !prev);
    setSeed(Date.now());
  };

  const handleShuffle = () => {
    setSeed(Date.now());
  };

  const latestBoundsRef = useRef(stageWidthBounds);
  useEffect(() => {
    latestBoundsRef.current = stageWidthBounds;
  }, [stageWidthBounds]);

  const handleResizePointerDown = (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const bounds = latestBoundsRef.current;
    const startWidth = stageWidth;
    const startHeight = stageHeight;

    const onPointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      const currentBounds = latestBoundsRef.current || bounds;
      const nextWidth = clamp(startWidth + deltaX, currentBounds.min, currentBounds.max);
      const rawHeight = clamp(startHeight + deltaY, STAGE_MIN_HEIGHT, STAGE_MAX_HEIGHT);
      setStageWidth(nextWidth);
      const nextRatio = clamp(rawHeight / Math.max(nextWidth, 1), RATIO_MIN, RATIO_MAX);
      setDesiredRatio(nextRatio);
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  };

  const stageClassName = mixPieces ? "collage-stage collage-stage--mixed" : "collage-stage";

  return (
    <div className="collage-root">
      {controlsVisible && (
        <div className="collage-panel">
          <div className="collage-controls">
          <div className="collage-control">
            <div className="collage-control-label">圖片數量</div>
            <div className="collage-control-inputs">
              <input
                type="range"
                min="1"
                max={Math.max(1, maxSelectableImages)}
                value={imageCount}
                onChange={(e) => handleImageCountChange(e.target.value)}
                className="collage-slider"
                disabled={!imagePool.length}
              />
              <input
                type="number"
                min="1"
                max={Math.max(1, maxSelectableImages)}
                value={imageCount}
                onChange={(e) => handleImageCountChange(e.target.value)}
                className="collage-number"
                disabled={!imagePool.length}
              />
            </div>
          </div>
          <div className="collage-control">
            <div className="collage-control-label">切片列數</div>
            <div className="collage-control-inputs">
              <input
                type="range"
                min="1"
                max={MAX_ROWS}
                value={rows}
                onChange={(e) => handleRowsChange(e.target.value)}
                className="collage-slider"
              />
              <input
                type="number"
                min="1"
                max={MAX_ROWS}
                value={rows}
                onChange={(e) => handleRowsChange(e.target.value)}
                className="collage-number"
              />
            </div>
          </div>
          <div className="collage-control">
            <div className="collage-control-label">切片行數</div>
            <div className="collage-control-inputs">
              <input
                type="range"
                min="1"
                max={MAX_COLS}
                value={cols}
                onChange={(e) => handleColsChange(e.target.value)}
                className="collage-slider"
              />
              <input
                type="number"
                min="1"
                max={MAX_COLS}
                value={cols}
                onChange={(e) => handleColsChange(e.target.value)}
                className="collage-number"
              />
            </div>
          </div>
          <label className="collage-toggle">
            <input type="checkbox" checked={mixPieces} onChange={toggleMixPieces} />
            <span>混合拼貼</span>
          </label>
          <button type="button" className="collage-button" onClick={handleShuffle}>
            重新打散
          </button>
        </div>
        <div className="collage-meta">
          <span>可用圖像：{imagePool.length}</span>
          <span>每張切片：{rows * cols}</span>
          <span>總片數：{totalPieces}</span>
          <span>拼貼模式：{mixPieces ? "混合" : "分離"}</span>
          {mixPieces && (
            <span>
              混合盤面：{mixBoard.rows} × {mixBoard.cols}
            </span>
          )}
          {mixPieces && (
            <span>
              邊緣配對：{edgesReady && edgeStatus === "ready" ? "已啟用" : edgeStatus === "loading" ? "分析中" : "隨機"}
            </span>
          )}
          {mixPieces && (
            <span>
              畫布尺寸：{Math.round(stageWidth)} × {Math.round(stageHeight)}
            </span>
          )}
        </div>
        </div>
      )}

      <div className={stageClassName} ref={rootRef}>
        {!loading && error && <div className="collage-status collage-status-error">{error}</div>}
        {!loading && selectedImages.length === 0 && !error && (
          <div className="collage-status">沒有圖像可顯示，請確認網址參數。</div>
        )}
        {!loading && !error && mixPieces && (
          <>
            <div
              className="collage-mix-surface"
              style={{
                width: `${stageWidth}px`,
                height: `${stageHeight}px`,
              }}
            >
              {mixedPieces.map((piece) => {
                const widthPercent = 100 / mixBoard.cols;
                const heightPercent = 100 / mixBoard.rows;
                const leftPercent = (piece.col / mixBoard.cols) * 100;
                const topPercent = (piece.row / mixBoard.rows) * 100;
                const backgroundX = cols <= 1 ? 50 : (piece.sourceCol / (cols - 1)) * 100;
                const backgroundY = rows <= 1 ? 50 : (piece.sourceRow / (rows - 1)) * 100;
                const imageUrl = buildImageUrl(imagesBase, piece.imageId);

                const style = {
                  width: `calc(${widthPercent}% + ${PIECE_OVERLAP_PX * 2}px)`,
                  height: `calc(${heightPercent}% + ${PIECE_OVERLAP_PX * 2}px)`,
                  left: `calc(${leftPercent}% - ${PIECE_OVERLAP_PX}px)`,
                  top: `calc(${topPercent}% - ${PIECE_OVERLAP_PX}px)`,
                  backgroundImage: `url("${imageUrl}")`,
                  backgroundSize: `${cols * 100}% ${rows * 100}%`,
                  backgroundPosition: `${backgroundX}% ${backgroundY}%`,
                  animationDelay: `${piece.delay.toFixed(2)}s`,
                  "--from-x": `${piece.fromX.toFixed(1)}px`,
                  "--from-y": `${piece.fromY.toFixed(1)}px`,
                  "--from-rot": `${piece.fromRot.toFixed(1)}deg`,
                };

                return <div key={piece.key} className="collage-piece collage-piece--mixed" style={style} />;
              })}
              <div
                ref={resizeHandleRef}
                className="collage-resize-handle"
                onPointerDown={handleResizePointerDown}
                role="presentation"
              />
            </div>
          </>
        )}

        {!loading && !error && !mixPieces &&
          selectedImages.map((imageId) => {
            const tilePieces = piecesByImage.get(imageId) || [];
            const imageUrl = buildImageUrl(imagesBase, imageId);
            const baseKey = imagesBase ?? "";
            const metric = imageMetrics[imageId];
            const tileRatio = metric && metric.base === baseKey ? metric.ratio : null;
            const tileStyle = tileRatio ? { aspectRatio: tileRatio } : undefined;
            return (
              <div key={imageId} className="collage-tile" style={tileStyle}>
                {tilePieces.map((piece) => {
                  const widthPercent = 100 / cols;
                  const heightPercent = 100 / rows;
                  const leftPercent = (piece.col / cols) * 100;
                  const topPercent = (piece.row / rows) * 100;
                  const backgroundX = cols <= 1 ? 50 : (piece.sourceCol / (cols - 1)) * 100;
                  const backgroundY = rows <= 1 ? 50 : (piece.sourceRow / (rows - 1)) * 100;

                  const style = {
                    width: `calc(${widthPercent}% + ${PIECE_OVERLAP_PX * 2}px)`,
                    height: `calc(${heightPercent}% + ${PIECE_OVERLAP_PX * 2}px)`,
                    left: `calc(${leftPercent}% - ${PIECE_OVERLAP_PX}px)`,
                    top: `calc(${topPercent}% - ${PIECE_OVERLAP_PX}px)`,
                    backgroundImage: `url("${imageUrl}")`,
                    backgroundSize: `${cols * 100}% ${rows * 100}%`,
                    backgroundPosition: `${backgroundX}% ${backgroundY}%`,
                    animationDelay: `${piece.delay.toFixed(2)}s`,
                    "--from-x": `${piece.fromX.toFixed(1)}px`,
                    "--from-y": `${piece.fromY.toFixed(1)}px`,
                    "--from-rot": `${piece.fromRot.toFixed(1)}deg`,
                  };

                  return <div key={piece.key} className="collage-piece" style={style} />;
                })}
                <div className="collage-label">{imageId}</div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
