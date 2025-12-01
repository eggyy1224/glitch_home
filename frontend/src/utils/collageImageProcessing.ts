import { mulberry32 } from "./collageMath";

type EdgeColors = {
  top: number[];
  bottom: number[];
  left: number[];
  right: number[];
  center: number[];
};

export type EdgeSample = Map<string, EdgeColors>;
type EdgeCache = Map<string, EdgeSample>;

export interface CollagePiece {
  imageId: string;
  sourceRow: number;
  sourceCol: number;
  key?: string;
  row?: number;
  col?: number;
  imageIndex?: number;
  fromX?: number;
  fromY?: number;
  fromRot?: number;
  delay?: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
  ratio: number;
}

const DEFAULT_MAX_CACHE_SIZE = 50;

const cleanupCache = <T>(cache: Map<string, T>, maxSize: number) => {
  if (cache.size > maxSize) {
    const entriesToDelete = Math.floor(cache.size * 0.25);
    const keysToDelete = Array.from(cache.keys()).slice(0, entriesToDelete);
    keysToDelete.forEach((key) => cache.delete(key));
  }
};

const defaultCreateImageElement = (): HTMLImageElement => new Image();
const defaultCreateCanvas = (): HTMLCanvasElement => document.createElement("canvas");

const loadImageElement = (url: string, createImageElement: () => HTMLImageElement) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = createImageElement();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`無法載入圖像 ${url}`));
    img.src = url;
  });

const averageRectColor = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  rectWidth: number,
  rectHeight: number,
): number[] => {
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

const colorDistance = (a?: number[], b?: number[]): number => {
  if (!a || !b) return 255 * 5;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

export const edgeKeyForPiece = (piece: Pick<CollagePiece, "imageId" | "sourceRow" | "sourceCol">) =>
  `${piece.imageId}|${piece.sourceRow}|${piece.sourceCol}`;

const evaluateSlotScore = (
  matrix: Array<Array<CollagePiece | null>>,
  row: number,
  col: number,
  rows: number,
  cols: number,
  edgeLookup: EdgeSample,
): number => {
  const piece = matrix[row][col];
  if (!piece) return Number.POSITIVE_INFINITY;
  const edges = edgeLookup.get(edgeKeyForPiece(piece));
  if (!edges) return Number.POSITIVE_INFINITY;

  let total = 0;
  let matches = 0;

  const accumulate = (
    neighborRow: number,
    neighborCol: number,
    selfEdgeKey: keyof EdgeColors,
    neighborEdgeKey: keyof EdgeColors,
  ) => {
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

  if (!matches) return Number.POSITIVE_INFINITY;
  return total / matches;
};

const optimizeBottomRightPlacement = (
  matrix: Array<Array<CollagePiece | null>>,
  rows: number,
  cols: number,
  edgeLookup: EdgeSample,
) => {
  const targetRow = rows - 1;
  const targetCol = cols - 1;
  let bestSwap = null;
  let bestImprovement = 0;

  const baseline = evaluateSlotScore(matrix, targetRow, targetCol, rows, cols, edgeLookup);
  if (!Number.isFinite(baseline)) return;

  for (let row = Math.max(0, rows - 3); row < rows; row += 1) {
    for (let col = Math.max(0, cols - 3); col < cols; col += 1) {
      if (row === targetRow && col === targetCol) continue;
      const candidate = matrix[row][col];
      matrix[row][col] = matrix[targetRow][targetCol];
      matrix[targetRow][targetCol] = candidate;
      const afterScore = evaluateSlotScore(matrix, targetRow, targetCol, rows, cols, edgeLookup);
      matrix[targetRow][targetCol] = matrix[row][col];
      matrix[row][col] = candidate;

      if (!Number.isFinite(afterScore)) continue;
      const improvement = baseline - afterScore;
      if (improvement > bestImprovement + 0.5) {
        bestImprovement = improvement;
        bestSwap = { row, col };
      }
    }
  }

  if (bestSwap && bestImprovement > 1.5) {
    const { row, col } = bestSwap;
    const targetPiece = matrix[targetRow][targetCol];
    matrix[targetRow][targetCol] = matrix[row][col];
    matrix[row][col] = targetPiece;
  }
};

export const createImageProcessing = ({
  maxCacheSize = DEFAULT_MAX_CACHE_SIZE,
  createImageElement = defaultCreateImageElement,
  createCanvas = defaultCreateCanvas,
}: {
  maxCacheSize?: number;
  createImageElement?: () => HTMLImageElement;
  createCanvas?: () => HTMLCanvasElement;
} = {}) => {
  const edgeSampleCache: EdgeCache = new Map();
  const imageDimensionCache: Map<string, ImageDimensions | Promise<ImageDimensions>> = new Map();

  const ensureImageDimensions = (imageUrl: string | null): Promise<ImageDimensions | null> => {
    if (!imageUrl) {
      return Promise.resolve(null);
    }
    const cached = imageDimensionCache.get(imageUrl);
    if (cached) {
      return cached instanceof Promise ? cached : Promise.resolve(cached);
    }
    const promise = loadImageElement(imageUrl, createImageElement)
      .then((img) => {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          throw new Error(`圖像尺寸為 0：${imageUrl}`);
        }
        const payload = { width, height, ratio: width / height };
        imageDimensionCache.set(imageUrl, payload);
        cleanupCache(imageDimensionCache, maxCacheSize);
        return payload;
      })
      .catch((err) => {
        const cachedValue = imageDimensionCache.get(imageUrl);
        if (cachedValue === promise) {
          imageDimensionCache.delete(imageUrl);
        }
        throw err;
      });
    imageDimensionCache.set(imageUrl, promise);
    return promise;
  };

  const computeEdgesForImage = async (
    imageId: string,
    imageUrl: string,
    rows: number,
    cols: number,
  ): Promise<EdgeSample> => {
    const cacheKey = `${imageUrl}|${rows}|${cols}`;
    if (edgeSampleCache.has(cacheKey)) {
      return edgeSampleCache.get(cacheKey) as EdgeSample;
    }

    const img = await loadImageElement(imageUrl, createImageElement);
    const sourceWidth = img.naturalWidth || img.width;
    const sourceHeight = img.naturalHeight || img.height;
    if (!sourceWidth || !sourceHeight) {
      throw new Error(`圖像尺寸為 0：${imageUrl}`);
    }

    const pieceSourceWidth = sourceWidth / cols;
    const pieceSourceHeight = sourceHeight / rows;

    const workCanvas = createCanvas();
    const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
    if (!workCtx) {
      throw new Error("無法取得 2D 繪圖上下文");
    }

    const result: EdgeSample = new Map();

    try {
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
    } finally {
      workCanvas.width = 0;
      workCanvas.height = 0;
      workCtx.clearRect(0, 0, 0, 0);
      (img as HTMLImageElement).src = "";
    }

    edgeSampleCache.set(cacheKey, result);
    cleanupCache(edgeSampleCache, maxCacheSize);
    return result;
  };

  const buildEdgeAwareMixedPieces = (
    pieces: CollagePiece[],
    rows: number,
    cols: number,
    seed: number,
    edgeLookup: EdgeSample,
  ): Array<CollagePiece & { row: number; col: number; key: string }> => {
    if (!pieces.length || !rows || !cols) return [];
    const capacity = rows * cols;
    const piecesPool: CollagePiece[] = [];
    while (piecesPool.length < capacity) {
      piecesPool.push(...pieces.map((piece) => ({ ...piece })));
    }
    const availablePieces = piecesPool.slice(0, capacity);

    const rand = mulberry32(seed ^ 0xabcdef);
    const available = availablePieces.map((piece) => ({ piece }));
    const placedMatrix: Array<Array<CollagePiece | null>> = Array.from({ length: rows }, () =>
      Array<CollagePiece | null>(cols).fill(null),
    );

    const slotOrder = Array.from({ length: capacity }, (_, index) => ({
      row: Math.floor(index / cols),
      col: index % cols,
    }));

    slotOrder.forEach(({ row, col }) => {
      let bestIdx = -1;
      let bestScore = Number.POSITIVE_INFINITY;

      for (let i = 0; i < available.length; i += 1) {
        const candidate = available[i].piece;
        if (!candidate) continue;
        const candidateEdges = edgeLookup.get(edgeKeyForPiece(candidate));
        if (!candidateEdges) continue;

        let score = 0;
        let matches = 0;

        if (col > 0 && placedMatrix[row][col - 1]) {
          const neighbor = placedMatrix[row][col - 1];
          if (!neighbor) continue;
          const neighborEdges = edgeLookup.get(edgeKeyForPiece(neighbor));
          if (neighborEdges) {
            score += colorDistance(neighborEdges.right, candidateEdges.left);
            matches += 1;
          }
        }

        if (row > 0 && placedMatrix[row - 1][col]) {
          const neighbor = placedMatrix[row - 1][col];
          if (!neighbor) continue;
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

      let chosen: CollagePiece | undefined;
      if (bestIdx < 0) {
        const fallbackIdx = Math.floor(rand() * available.length);
        chosen = available.splice(fallbackIdx, 1)[0]?.piece;
      } else {
        chosen = available.splice(bestIdx, 1)[0]?.piece;
      }

      placedMatrix[row][col] = chosen || null;
    });

    optimizeBottomRightPlacement(placedMatrix, rows, cols, edgeLookup);

    const results: Array<CollagePiece & { row: number; col: number; key: string }> = [];
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

  return {
    ensureImageDimensions,
    computeEdgesForImage,
    buildEdgeAwareMixedPieces,
    edgeSampleCache,
    imageDimensionCache,
  };
};

export const defaultImageProcessing = createImageProcessing();

export type CollageImageProcessing = ReturnType<typeof createImageProcessing>;
