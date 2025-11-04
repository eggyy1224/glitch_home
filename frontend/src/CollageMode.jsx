import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./CollageMode.css";
import { fetchKinship } from "./api.js";
import { ensureHtml2Canvas } from "./utils/html2canvasLoader.js";

const DEFAULT_IMAGE_COUNT = 4;
const DEFAULT_ROWS = 3;
const DEFAULT_COLS = 3;
const MAX_IMAGES = 30;
const MAX_ROWS = 24;
const MAX_COLS = 24;
const DEFAULT_STAGE_WIDTH = 960;
const STAGE_MIN_WIDTH = 360;
const STAGE_MAX_WIDTH = 3840;
const STAGE_MIN_HEIGHT = 240;
const STAGE_MAX_HEIGHT = 2160;
const DEFAULT_STAGE_HEIGHT = 540;
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
  const maxRows = Math.min(count, 64);
  let bestRows = 1;
  let bestCols = count;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let rowsCandidate = 1; rowsCandidate <= maxRows; rowsCandidate += 1) {
    const colsCandidate = Math.ceil(count / rowsCandidate);
    if (colsCandidate <= 0) continue;
    const candidateRatio = rowsCandidate / colsCandidate;
    const ratioScore = Math.abs(Math.log(candidateRatio) - Math.log(ratio));
    const extraSlots = rowsCandidate * colsCandidate - count;
    const extraPenalty = extraSlots > 0 ? extraSlots / count : 0;
    const balancePenalty = Math.abs(rowsCandidate - colsCandidate) / count;
    const score = ratioScore + extraPenalty * 0.05 + balancePenalty * 0.001;
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

const loadImageElement = (url) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`無法載入圖像 ${url}`));
    img.src = url;
  });

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

  const assignCount = Math.min(shuffledPieces.length, totalSlots);
  const result = [];
  for (let i = 0; i < assignCount; i += 1) {
    const slot = shuffledSlots[i];
    const piece = shuffledPieces[i];
    result.push({
      ...piece,
      row: slot.row,
      col: slot.col,
      key: `${slot.row}-${slot.col}-${piece.key}`,
    });
  }
  return result;
};

const buildEdgeAwareMixedPieces = (pieces, rows, cols, seed, edgeLookup) => {
  if (!pieces.length || !rows || !cols) return [];
  const capacity = rows * cols;
  const count = Math.min(pieces.length, capacity);
  if (!count) return [];

  const rand = mulberry32(seed ^ 0xabcdef);
  const available = pieces.map((piece) => ({ piece }));
  const placedMatrix = Array.from({ length: rows }, () => Array(cols).fill(null));
  const results = [];

  const slotOrder = Array.from({ length: count }, (_, index) => ({
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
    results.push({
      ...chosen,
      row,
      col,
      key: `${row}-${col}-${chosen.key}`,
    });
  });

  return results;
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

  const syncQueryParam = useCallback((key, value, { removeWhenDefault = false, defaultValue = null } = {}) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (removeWhenDefault && value === defaultValue) {
      if (!params.has(key)) return;
      params.delete(key);
    } else {
      const stringValue = String(value);
      if (params.get(key) === stringValue) return;
      params.set(key, stringValue);
    }
    const qs = params.toString();
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }, []);

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
  const mixSurfaceAspectRatio = useMemo(() => {
    if (!Number.isFinite(boardRatio) || boardRatio <= 0) {
      return DEFAULT_STAGE_WIDTH / DEFAULT_STAGE_HEIGHT;
    }
    return 1 / boardRatio;
  }, [boardRatio]);
  const stageHeight = useMemo(() => stageWidth * boardRatio, [stageWidth, boardRatio]);

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
    syncQueryParam("collage_images", imageCount);
  }, [imageCount, syncQueryParam]);

  useEffect(() => {
    syncQueryParam("collage_rows", rows);
  }, [rows, syncQueryParam]);

  useEffect(() => {
    syncQueryParam("collage_cols", cols);
  }, [cols, syncQueryParam]);

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
    syncQueryParam("collage_mix", mixPieces ? "true" : "false", { removeWhenDefault: true, defaultValue: "false" });
  }, [mixPieces, syncQueryParam]);

  useEffect(() => {
    syncQueryParam("collage_width", Math.round(stageWidth));
  }, [stageWidth, syncQueryParam]);

  useEffect(() => {
    syncQueryParam("collage_height", Math.round(stageHeight));
  }, [stageHeight, syncQueryParam]);

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
        {loading && <div className="collage-status">載入圖像中...</div>}
        {!loading && error && <div className="collage-status collage-status-error">{error}</div>}
        {!loading && selectedImages.length === 0 && !error && (
          <div className="collage-status">沒有圖像可顯示，請確認網址參數。</div>
        )}
        {!loading && !error && mixPieces && edgeStatus === "loading" && !edgesReady && (
          <div className="collage-status">拼貼接縫分析中…</div>
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
                  width: `${widthPercent}%`,
                  height: `${heightPercent}%`,
                  left: `${leftPercent}%`,
                  top: `${topPercent}%`,
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
            return (
              <div key={imageId} className="collage-tile">
                {tilePieces.map((piece) => {
                  const widthPercent = 100 / cols;
                  const heightPercent = 100 / rows;
                  const leftPercent = (piece.col / cols) * 100;
                  const topPercent = (piece.row / rows) * 100;
                  const backgroundX = cols <= 1 ? 50 : (piece.sourceCol / (cols - 1)) * 100;
                  const backgroundY = rows <= 1 ? 50 : (piece.sourceRow / (rows - 1)) * 100;

                  const style = {
                    width: `${widthPercent}%`,
                    height: `${heightPercent}%`,
                    left: `${leftPercent}%`,
                    top: `${topPercent}%`,
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
