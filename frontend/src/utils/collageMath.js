import {
  COLLAGE_MAX_ROWS,
  COLLAGE_RATIO_MAX,
  COLLAGE_RATIO_MIN,
  COLLAGE_STAGE_MAX_HEIGHT,
  COLLAGE_STAGE_MAX_WIDTH,
  COLLAGE_STAGE_MIN_HEIGHT,
  COLLAGE_STAGE_MIN_WIDTH,
} from "../constants/collage.js";

export const cleanCollageId = (value) => (value ? value.replace(/:(en|zh)$/i, "") : value);

export const clamp = (value, min, max) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
};

export const buildImagePool = (payload, fallback) => {
  const list = [];
  const seen = new Set();
  const push = (value) => {
    const clean = cleanCollageId(value);
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

export const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let result = Math.imul(t ^ (t >>> 15), 1 | t);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
};

export const buildPieces = (images, rows, cols, seed) => {
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

export const buildImageUrl = (base, imageId) => {
  if (!imageId) return "";
  if (!base) return imageId;
  return base.endsWith("/") ? `${base}${imageId}` : `${base}/${imageId}`;
};

export const computeStageWidthBounds = (ratio) => {
  if (!Number.isFinite(ratio) || ratio <= 0) {
    return { min: COLLAGE_STAGE_MIN_WIDTH, max: COLLAGE_STAGE_MAX_WIDTH };
  }
  const minWidthCandidate = COLLAGE_STAGE_MIN_HEIGHT / ratio;
  const maxWidthCandidate = COLLAGE_STAGE_MAX_HEIGHT / ratio;
  let minWidth = Math.max(COLLAGE_STAGE_MIN_WIDTH, Math.min(minWidthCandidate, COLLAGE_STAGE_MAX_WIDTH));
  let maxWidth = Math.min(COLLAGE_STAGE_MAX_WIDTH, Math.max(maxWidthCandidate, COLLAGE_STAGE_MIN_WIDTH));
  if (minWidth > maxWidth) {
    const fallback = clamp(
      (minWidth + maxWidthCandidate) / 2,
      COLLAGE_STAGE_MIN_WIDTH,
      COLLAGE_STAGE_MAX_WIDTH,
    );
    minWidth = fallback;
    maxWidth = fallback;
  }
  return { min: minWidth, max: maxWidth };
};

export const computeBoardLayout = (count, targetRatio) => {
  if (!count || count <= 0) {
    return { rows: 1, cols: 1 };
  }
  const ratio = clamp(
    Number.isFinite(targetRatio) && targetRatio > 0 ? targetRatio : 1,
    COLLAGE_RATIO_MIN,
    COLLAGE_RATIO_MAX,
  );
  const maxRows = Math.min(count, COLLAGE_MAX_ROWS);
  let bestRows = 1;
  let bestCols = count;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let rowsCandidate = 1; rowsCandidate <= maxRows; rowsCandidate += 1) {
    const colsCandidate = Math.ceil(count / rowsCandidate);
    if (colsCandidate <= 0) continue;
    const totalSlots = rowsCandidate * colsCandidate;
    const candidateRatio = rowsCandidate / colsCandidate;
    const ratioScore = Math.abs(Math.log(candidateRatio) - Math.log(ratio));
    const balancePenalty = Math.abs(rowsCandidate - colsCandidate) / count;

    const isPerfectFit = totalSlots === count;
    const extraSlots = totalSlots - count;

    let baseScore;
    if (isPerfectFit) {
      baseScore = ratioScore + balancePenalty * 0.001;
    } else {
      const extraPenalty = extraSlots > 0 ? (extraSlots / count) * 0.02 : (Math.abs(extraSlots) / count) * 0.15;
      baseScore = ratioScore + extraPenalty + balancePenalty * 0.001;
    }

    const perfectFitBonus = isPerfectFit ? -0.15 : 0;
    const score = baseScore + perfectFitBonus;

    if (score < bestScore) {
      bestScore = score;
      bestRows = rowsCandidate;
      bestCols = colsCandidate;
    }
  }

  return { rows: Math.max(1, bestRows), cols: Math.max(1, bestCols) };
};

export const shuffleWithRng = (array, rng) => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = result[i];
    result[i] = result[j];
    result[j] = tmp;
  }
  return result;
};

export const buildRandomMixedPieces = (pieces, rows, cols, seed) => {
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
