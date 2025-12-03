import { useEffect, useMemo, useState } from "react";
import { buildImageUrl, buildPieces, buildRandomMixedPieces, computeBoardLayout } from "../utils/collageMath";
import {
  COLLAGE_DEFAULT_STAGE_HEIGHT as DEFAULT_STAGE_HEIGHT,
  COLLAGE_DEFAULT_STAGE_WIDTH as DEFAULT_STAGE_WIDTH,
} from "../constants/collage";
import {
  edgeKeyForPiece,
  type CollagePiece,
  type CollageImageProcessing,
  type EdgeSample,
} from "../utils/collageImageProcessing";

export type CollageEdgeStatus = "idle" | "loading" | "ready" | "failed";

interface UseCollagePiecesOptions {
  selectedImages: string[];
  rows: number;
  cols: number;
  seed: number;
  mixPieces: boolean;
  desiredRatio: number;
  imagesBase?: string;
  imageProcessing: CollageImageProcessing;
}

export function useCollagePieces({
  selectedImages,
  rows,
  cols,
  seed,
  mixPieces,
  desiredRatio,
  imagesBase,
  imageProcessing,
}: UseCollagePiecesOptions) {
  const pieces = useMemo<CollagePiece[]>(() => buildPieces(selectedImages, rows, cols, seed), [selectedImages, rows, cols, seed]);
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
  }, [mixBoard.cols, mixBoard.rows]);

  const piecesByImage = useMemo<Map<string, CollagePiece[]>>(() => {
    const map = new Map<string, CollagePiece[]>();
    pieces.forEach((piece) => {
      const list = map.get(piece.imageId);
      if (list) {
        list.push(piece);
      } else {
        map.set(piece.imageId, [piece]);
      }
    });
    return map;
  }, [pieces]);

  const [edgeLookup, setEdgeLookup] = useState<EdgeSample>(() => new Map());
  const [edgeStatus, setEdgeStatus] = useState<CollageEdgeStatus>("idle");

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
    if (!mixPieces) {
      setEdgeLookup(new Map());
      setEdgeStatus("idle");
      return undefined;
    }
    let cancelled = false;
    setEdgeStatus("loading");
    const run = async () => {
      try {
        const aggregate: EdgeSample = new Map();
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

  return {
    pieces,
    totalPieces,
    mixBoard,
    boardRatio,
    piecesByImage,
    mixedPieces,
    edgeStatus,
    edgesReady,
  };
}
