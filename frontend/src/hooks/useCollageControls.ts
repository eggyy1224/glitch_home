import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchKinship } from "../api";
import { ensureHtml2Canvas } from "../utils/html2canvasLoader";
import {
  buildImagePool,
  buildImageUrl,
  buildPieces,
  buildRandomMixedPieces,
  cleanCollageId,
  clamp,
  computeBoardLayout,
  computeStageWidthBounds,
} from "../utils/collageMath";
import {
  defaultImageProcessing,
  edgeKeyForPiece,
} from "../utils/collageImageProcessing";
import { defaultCollageStateUtils } from "../utils/collageStateUtils";
import {
  COLLAGE_DEFAULT_COLS as DEFAULT_COLS,
  COLLAGE_DEFAULT_IMAGE_COUNT as DEFAULT_IMAGE_COUNT,
  COLLAGE_DEFAULT_ROWS as DEFAULT_ROWS,
  COLLAGE_DEFAULT_STAGE_HEIGHT as DEFAULT_STAGE_HEIGHT,
  COLLAGE_DEFAULT_STAGE_WIDTH as DEFAULT_STAGE_WIDTH,
  COLLAGE_MAX_COLS as MAX_COLS,
  COLLAGE_MAX_IMAGES as MAX_IMAGES,
  COLLAGE_MAX_ROWS as MAX_ROWS,
  COLLAGE_PIECE_OVERLAP_PX as PIECE_OVERLAP_PX,
  COLLAGE_RATIO_MAX as RATIO_MAX,
  COLLAGE_RATIO_MIN as RATIO_MIN,
  COLLAGE_STAGE_MAX_HEIGHT as STAGE_MAX_HEIGHT,
  COLLAGE_STAGE_MAX_WIDTH as STAGE_MAX_WIDTH,
  COLLAGE_STAGE_MIN_HEIGHT as STAGE_MIN_HEIGHT,
  COLLAGE_STAGE_MIN_WIDTH as STAGE_MIN_WIDTH,
} from "../constants/collage";

const PERSIST_COLLAGE_QUERY =
  String(import.meta.env.VITE_COLLAGE_PERSIST_QUERY ?? "false").trim().toLowerCase() === "true";

export function useCollageControls({
  imagesBase,
  anchorImage,
  onCaptureReady = null,
  remoteConfig = null,
  controlsEnabled = true,
  remoteSource = null,
  imageProcessing = defaultImageProcessing,
  stateUtils = defaultCollageStateUtils,
}) {
  const rootRef = useRef(null);
  const resizeHandleRef = useRef(null);
  const html2canvasPromiseRef = useRef(null);
  const ensureHtml2canvasReady = useCallback(() => {
    if (!html2canvasPromiseRef.current) {
      html2canvasPromiseRef.current = ensureHtml2Canvas();
    }
    return html2canvasPromiseRef.current;
  }, []);

  useEffect(() => {
    ensureHtml2canvasReady();
  }, [ensureHtml2canvasReady]);

  const initialStageWidth = useMemo(
    () => stateUtils.readInitialParam("collage_width", DEFAULT_STAGE_WIDTH, STAGE_MIN_WIDTH, STAGE_MAX_WIDTH),
    [stateUtils],
  );
  const initialStageHeight = useMemo(
    () => stateUtils.readInitialParam("collage_height", DEFAULT_STAGE_HEIGHT, STAGE_MIN_HEIGHT, STAGE_MAX_HEIGHT),
    [stateUtils],
  );
  const initialDesiredRatio = useMemo(
    () => stateUtils.calculateDesiredRatio(initialStageWidth, initialStageHeight),
    [initialStageHeight, initialStageWidth, stateUtils],
  );

  const [imagePool, setImagePool] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [seed, setSeed] = useState(() => stateUtils.nextSeed());
  const [imageCount, setImageCount] = useState(() =>
    stateUtils.readInitialParam("collage_images", DEFAULT_IMAGE_COUNT, 1, MAX_IMAGES),
  );
  const [rows, setRows] = useState(() => stateUtils.readInitialParam("collage_rows", DEFAULT_ROWS, 1, MAX_ROWS));
  const [cols, setCols] = useState(() => stateUtils.readInitialParam("collage_cols", DEFAULT_COLS, 1, MAX_COLS));
  const [mixPieces, setMixPieces] = useState(() => stateUtils.readInitialBooleanParam("collage_mix", false));
  const [edgeLookup, setEdgeLookup] = useState(() => new Map());
  const [edgeStatus, setEdgeStatus] = useState("idle");
  const [stageWidth, setStageWidth] = useState(() => initialStageWidth);
  const [stageHeight, setStageHeight] = useState(() => initialStageHeight);
  const [desiredRatio, setDesiredRatio] = useState(() => initialDesiredRatio);
  const [remoteStageHeightSet, setRemoteStageHeightSet] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [imageMetrics, setImageMetrics] = useState(() => ({}));
  const fetchedPoolRef = useRef([]);
  const remoteOverrideRef = useRef(false);
  const [remoteOverrideActive, setRemoteOverrideActive] = useState(false);

  useEffect(() => {
    remoteOverrideRef.current = remoteOverrideActive;
  }, [remoteOverrideActive]);

  useEffect(() => {
    if (onCaptureReady == null) return undefined;

    const captureScene = async () => {
      const root = rootRef.current;
      if (!root) {
        throw new Error("Collage 模式尚未準備好");
      }

      const html2canvas = await ensureHtml2canvasReady();

      const maxWaitTime = 3000;
      const checkInterval = 100;
      let waited = 0;
      let piecesElements = root.querySelectorAll(".collage-piece");

      while (piecesElements.length === 0 && waited < maxWaitTime) {
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
        waited += checkInterval;
        piecesElements = root.querySelectorAll(".collage-piece");
      }

      if (piecesElements.length === 0) {
        const isLoading = root.querySelector(".collage-status")?.textContent?.includes("載入中");
        const hasError = root.querySelector(".collage-status-error");
        const noImages = root.querySelector(".collage-status")?.textContent?.includes("沒有圖像");

        if (isLoading) {
          throw new Error("Collage 仍在載入中，請稍後再試");
        }
        if (hasError) {
          throw new Error(`Collage 載入錯誤: ${hasError.textContent}`);
        }
        if (noImages) {
          throw new Error("Collage 沒有可用的圖像");
        }
        throw new Error(`Collage 碎片尚未渲染完成（等待 ${waited}ms 後仍無碎片），請稍後再試`);
      }

      let loadedCount = 0;
      piecesElements.forEach((el) => {
        const bgImage = window.getComputedStyle(el).backgroundImage;
        if (bgImage && bgImage !== "none" && !bgImage.includes("data:")) {
          loadedCount += 1;
        }
      });

      if (loadedCount === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        piecesElements = root.querySelectorAll(".collage-piece");
        loadedCount = 0;
        piecesElements.forEach((el) => {
          const bgImage = window.getComputedStyle(el).backgroundImage;
          if (bgImage && bgImage !== "none" && !bgImage.includes("data:")) {
            loadedCount += 1;
          }
        });
      }

      const mixSurface = root.querySelector(".collage-mix-surface");
      const tiles = root.querySelectorAll(".collage-tile");
      let targetElement = root;
      let rootWidth = root.clientWidth;
      let rootHeight = root.clientHeight;
      const rootRect = root.getBoundingClientRect();
      if (mixSurface) {
        const mixRect = mixSurface.getBoundingClientRect();
        const margin = PIECE_OVERLAP_PX * 2;
        const mixWidth = mixSurface.scrollWidth || mixRect.width;
        const mixHeight = mixSurface.scrollHeight || mixRect.height;
        if (mixWidth > 0 && mixHeight > 0) {
          rootWidth = mixWidth + margin * 2;
          rootHeight = mixHeight + margin * 2;
          targetElement = mixSurface;
        } else {
          rootWidth = mixRect.width + margin * 2;
          rootHeight = mixRect.height + margin * 2;
          targetElement = mixSurface;
        }
      } else if (tiles.length > 0) {
        const scrollWidth = root.scrollWidth;
        const scrollHeight = root.scrollHeight;
        if (scrollWidth > 0 && scrollHeight > 0) {
          rootWidth = scrollWidth;
          rootHeight = scrollHeight;
        }
      }

      if (rootWidth <= 0 || rootHeight <= 0 || !Number.isFinite(rootWidth) || !Number.isFinite(rootHeight)) {
        rootWidth = rootRect.width || 1920;
        rootHeight = rootRect.height || 1080;
      }

      const pieceCount = piecesElements.length;
      const canvasArea = rootWidth * rootHeight;
      let scale = 1;
      let timeout = 30000;
      if (canvasArea > 8000000) {
        scale = 0.3;
        timeout = 120000;
      } else if (canvasArea > 5000000) {
        scale = 0.4;
        timeout = 90000;
      } else if (canvasArea > 3000000) {
        scale = 0.5;
        timeout = 60000;
      } else if (canvasArea > 2000000) {
        scale = 0.6;
        timeout = 45000;
      }

      if (pieceCount > 2000) {
        scale = Math.min(scale, 0.7);
        timeout = Math.max(timeout, 60000);
      }
      if (pieceCount > 3000) {
        scale = Math.min(scale, 0.5);
        timeout = Math.max(timeout, 90000);
      }
      if (pieceCount > 5000) {
        scale = Math.min(scale, 0.4);
        timeout = Math.max(timeout, 120000);
      }

      const maxCanvasSize = 16384;
      const scaledWidth = rootWidth * scale;
      const scaledHeight = rootHeight * scale;

      if (scaledWidth > maxCanvasSize || scaledHeight > maxCanvasSize) {
        const widthScale = maxCanvasSize / rootWidth;
        const heightScale = maxCanvasSize / rootHeight;
        scale = Math.min(scale, widthScale, heightScale) * 0.95;
      }

      console.log(`[CollageMode] 截圖尺寸: ${rootWidth}×${rootHeight} (scale: ${scale})`);

      const canvas = await html2canvas(targetElement, {
        backgroundColor: "#050508",
        logging: false,
        useCORS: true,
        allowTaint: false,
        scale,
        timeout,
        removeContainer: false,
        foreignObjectRendering: false,
        onclone: (doc) => {
          doc.querySelectorAll(".collage-piece").forEach((el) => {
            el.style.animation = "none";
            el.style.opacity = "1";
            el.style.transform = "none";
            el.style.visibility = "visible";
            el.style.display = "";
          });
          const clonedMixSurface = doc.querySelector(".collage-mix-surface");
          if (clonedMixSurface) {
            clonedMixSurface.style.overflow = "visible";
            clonedMixSurface.style.position = "relative";
            clonedMixSurface.style.width = `${rootWidth}px`;
            clonedMixSurface.style.height = `${rootHeight}px`;
            clonedMixSurface.style.maxWidth = "none";
            clonedMixSurface.style.maxHeight = "none";
          }
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
  }, [onCaptureReady, ensureHtml2canvasReady]);

  useEffect(() => {
    let cancelled = false;
    const cleanAnchor = cleanCollageId(anchorImage);

    if (!cleanAnchor) {
      if (!remoteOverrideRef.current) {
        setImagePool([]);
        setError("請在網址加上 ?img=檔名 以啟動拼貼模式。");
      } else {
        setError(null);
      }
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
        const nextPool = pool.length ? pool : [cleanAnchor];
        fetchedPoolRef.current = nextPool;
        if (!remoteOverrideRef.current) {
          setImagePool(nextPool);
          if (!pool.length) {
            setError("沒有找到關聯圖像，改以原圖拼貼。");
          }
        } else if (!pool.length) {
          setError("沒有找到關聯圖像，改以原圖拼貼。");
        }
      } catch (err) {
        if (cancelled) return;
        const fallbackPool = cleanAnchor ? [cleanAnchor] : [];
        fetchedPoolRef.current = fallbackPool;
        if (!remoteOverrideRef.current) {
          setImagePool(fallbackPool);
        }
        setError(err?.message || "載入圖像清單失敗");
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

  useEffect(() => {
    if (!remoteConfig) {
      if (remoteOverrideRef.current) {
        setRemoteOverrideActive(false);
        setImagePool(fetchedPoolRef.current);
      }
      setRemoteStageHeightSet(false);
      return;
    }

    const nextImages = Array.isArray(remoteConfig.images) ? remoteConfig.images : [];
    if (nextImages.length) {
      setRemoteOverrideActive(true);
      setImagePool(nextImages);
      setError(null);
      setLoading(false);
    } else if (remoteOverrideRef.current) {
      setRemoteOverrideActive(false);
      setImagePool(fetchedPoolRef.current);
    }

    if (typeof remoteConfig.image_count === "number") {
      const targetCount = clamp(remoteConfig.image_count, 1, MAX_IMAGES);
      setImageCount((prev) => (prev === targetCount ? prev : targetCount));
    }

    if (typeof remoteConfig.rows === "number") {
      const targetRows = clamp(remoteConfig.rows, 1, MAX_ROWS);
      setRows((prev) => (prev === targetRows ? prev : targetRows));
    }

    if (typeof remoteConfig.cols === "number") {
      const targetCols = clamp(remoteConfig.cols, 1, MAX_COLS);
      setCols((prev) => (prev === targetCols ? prev : targetCols));
    }

    if (typeof remoteConfig.mix === "boolean") {
      const mixValue = Boolean(remoteConfig.mix);
      setMixPieces((prev) => (prev === mixValue ? prev : mixValue));
    }

    if (remoteConfig.seed !== undefined && remoteConfig.seed !== null) {
      const targetSeed = Math.floor(remoteConfig.seed);
      setSeed((prev) => (prev === targetSeed ? prev : targetSeed));
    }

    if (typeof remoteConfig.stage_width === "number") {
      const clampedWidth = clamp(remoteConfig.stage_width, STAGE_MIN_WIDTH, STAGE_MAX_WIDTH);
      setStageWidth((prev) => (Math.abs(prev - clampedWidth) < 0.5 ? prev : clampedWidth));
    }

    if (typeof remoteConfig.stage_height === "number") {
      const clampedHeight = clamp(remoteConfig.stage_height, STAGE_MIN_HEIGHT, STAGE_MAX_HEIGHT);
      setStageHeight((prev) => (Math.abs(prev - clampedHeight) < 0.5 ? prev : clampedHeight));
      setRemoteStageHeightSet(true);
    } else if (remoteConfig.stage_height === null || remoteConfig.stage_height === undefined) {
      setRemoteStageHeightSet(false);
    }

    if (
      typeof remoteConfig.stage_width === "number" &&
      typeof remoteConfig.stage_height === "number" &&
      remoteConfig.stage_width > 0
    ) {
      const nextRatio = clamp(
        remoteConfig.stage_height / Math.max(remoteConfig.stage_width, 1),
        RATIO_MIN,
        RATIO_MAX,
      );
      setDesiredRatio((prev) => (Math.abs(prev - nextRatio) < 0.001 ? prev : nextRatio));
    }
  }, [remoteConfig]);

  const maxSelectableImages = useMemo(() => {
    if (!imagePool.length) return 1;
    return Math.min(MAX_IMAGES, imagePool.length);
  }, [imagePool]);

  const imageCountMax = useMemo(() => Math.max(1, maxSelectableImages), [maxSelectableImages]);

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
  const computedStageHeight = useMemo(() => stageWidth * boardRatio, [stageWidth, boardRatio]);
  const finalStageHeight = remoteStageHeightSet ? stageHeight : computedStageHeight;

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
      applyParam("collage_height", Math.round(finalStageHeight), DEFAULT_STAGE_HEIGHT);
    } else {
      if (params.has("collage_width")) params.delete("collage_width");
      if (params.has("collage_height")) params.delete("collage_height");
    }

    const after = params.toString();
    if (after !== before) {
      window.history.replaceState(null, "", after ? `${url.pathname}?${after}` : url.pathname);
    }
  }, [imageCount, rows, cols, mixPieces, stageWidth, finalStageHeight]);

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
      imageProcessing.ensureImageDimensions(imageUrl)
        .then((dimensions) => {
          if (cancelled || !dimensions) return;
          setImageMetrics((prev) => {
            const nextMetric = prev[imageId];
            if (nextMetric && nextMetric.base === baseKey) {
              return prev;
            }
            const cleaned = { ...prev };
            Object.keys(cleaned).forEach((key) => {
              if (!selectedImages.includes(key) && cleaned[key].base === baseKey) {
                delete cleaned[key];
              }
            });
            return {
              ...cleaned,
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
  }, [selectedImages, imagesBase, imageProcessing]);

  const edgesReady = useMemo(
    () => pieces.every((piece) => edgeLookup.has(edgeKeyForPiece(piece))),
    [pieces, edgeLookup],
  );

  const mixedPieces = useMemo(() => {
    if (!mixPieces) return [];
    if (edgesReady) {
      return imageProcessing.buildEdgeAwareMixedPieces(
        pieces,
        mixBoard.rows,
        mixBoard.cols,
        seed,
        edgeLookup,
      );
    }
    return buildRandomMixedPieces(pieces, mixBoard.rows, mixBoard.cols, seed);
  }, [mixPieces, pieces, mixBoard.rows, mixBoard.cols, seed, edgeLookup, edgesReady, imageProcessing]);

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
      setSeed(stateUtils.nextSeed());
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
            const map = await imageProcessing.computeEdgesForImage(imageId, imageUrl, rows, cols);
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
  }, [mixPieces, selectedImages, rows, cols, imagesBase, imageProcessing]);

  const handleImageCountChange = useCallback(
    (eventOrValue) => {
      if (!controlsEnabled) return;
      const raw = typeof eventOrValue === "number" ? eventOrValue : eventOrValue?.target?.value;
      const parsed = Number.parseInt(raw, 10);
      if (Number.isNaN(parsed)) return;
      setImageCount(clamp(parsed, 1, maxSelectableImages));
      setSeed(stateUtils.nextSeed());
    },
    [controlsEnabled, maxSelectableImages, stateUtils],
  );

  const handleRowsChange = useCallback(
    (eventOrValue) => {
      if (!controlsEnabled) return;
      const raw = typeof eventOrValue === "number" ? eventOrValue : eventOrValue?.target?.value;
      const parsed = Number.parseInt(raw, 10);
      if (Number.isNaN(parsed)) return;
      setRows(clamp(parsed, 1, MAX_ROWS));
      setSeed(stateUtils.nextSeed());
    },
    [controlsEnabled, stateUtils],
  );

  const handleColsChange = useCallback(
    (eventOrValue) => {
      if (!controlsEnabled) return;
      const raw = typeof eventOrValue === "number" ? eventOrValue : eventOrValue?.target?.value;
      const parsed = Number.parseInt(raw, 10);
      if (Number.isNaN(parsed)) return;
      setCols(clamp(parsed, 1, MAX_COLS));
      setSeed(stateUtils.nextSeed());
    },
    [controlsEnabled, stateUtils],
  );

  const toggleMixPieces = useCallback(() => {
    if (!controlsEnabled) return;
    setMixPieces((prev) => !prev);
    setSeed(stateUtils.nextSeed());
  }, [controlsEnabled, stateUtils]);

  const handleShuffle = useCallback(() => {
    if (!controlsEnabled) return;
    setSeed(stateUtils.nextSeed());
  }, [controlsEnabled, stateUtils]);

  const latestBoundsRef = useRef(stageWidthBounds);
  useEffect(() => {
    latestBoundsRef.current = stageWidthBounds;
  }, [stageWidthBounds]);

  const handleResizePointerDown = useCallback(
    (event) => {
      if (!controlsEnabled) return;
      if (event.button !== 0) return;
      event.preventDefault();
      const startX = event.clientX;
      const startY = event.clientY;
      const bounds = latestBoundsRef.current;
      const startWidth = stageWidth;
      const startHeight = finalStageHeight;

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
    },
    [controlsEnabled, stageWidth, finalStageHeight],
  );

  const stageClassName = mixPieces ? "collage-stage collage-stage--mixed" : "collage-stage";

  return {
    rootRef,
    resizeHandleRef,
    stageClassName,
    controlsVisible,
    controlsEnabled,
    remoteSource,
    loading,
    error,
    imagePool,
    selectedImages,
    piecesByImage,
    imageMetrics,
    mixPieces,
    mixBoard,
    mixedPieces,
    edgesReady,
    edgeStatus,
    rows,
    cols,
    imageCount,
    totalPieces,
    stageWidth,
    finalStageHeight,
    handleImageCountChange,
    handleRowsChange,
    handleColsChange,
    toggleMixPieces,
    handleShuffle,
    handleResizePointerDown,
    imageCountMax,
  };
}
