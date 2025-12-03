import { useEffect, useState } from "react";
import { buildImageUrl } from "../utils/collageMath";
import type { CollageImageProcessing, ImageDimensions } from "../utils/collageImageProcessing";

export interface CollageImageMetric extends ImageDimensions {
  base: string;
}

interface UseCollageImageMetricsOptions {
  selectedImages: string[];
  imagesBase?: string;
  imageProcessing: CollageImageProcessing;
}

export function useCollageImageMetrics({
  selectedImages,
  imagesBase,
  imageProcessing,
}: UseCollageImageMetricsOptions) {
  const [imageMetrics, setImageMetrics] = useState<Record<string, CollageImageMetric>>(() => ({}));

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

  return { imageMetrics, setImageMetrics };
}
