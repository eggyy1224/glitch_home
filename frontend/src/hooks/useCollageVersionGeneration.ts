import React, { useEffect, useRef, useState } from "react";
import { generateCollageVersionFromNames, getCollageProgress } from "../api";

export interface CollageGenerationResult {
  output_image?: string;
  imageUrl?: string;
  completed?: boolean;
  error?: string | null;
  progress?: number;
  stage?: string;
  message?: string;
  width?: number;
  height?: number;
  output_format?: string;
  parents?: string[];
  task_id?: string;
  [key: string]: unknown;
}

interface CollageParams {
  [key: string]: unknown;
  rows: number;
  cols: number;
  mode: string;
  seed: number;
  resize_w: number;
  pad_px: number;
  jitter_px: number;
  rotate_deg: number;
  format: string;
  quality: number;
  return_map?: boolean;
}

interface UseCollageVersionGenerationOptions {
  apiBase: string;
  selectedImages: string[];
  minRequired: number;
  generationDisabled: boolean;
  blockedMessage: string;
  params: CollageParams;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useCollageVersionGeneration({
  apiBase,
  selectedImages,
  minRequired,
  generationDisabled,
  blockedMessage,
  params,
  setError,
}: UseCollageVersionGenerationOptions) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CollageGenerationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const handleGenerate = async () => {
    if (generationDisabled) {
      setError(blockedMessage);
      return;
    }
    if (selectedImages.length < minRequired) {
      setError(`至少需要選擇 ${minRequired} 張圖片`);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setProgressStage("");
    setProgressMessage("");

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    try {
      const response = (await generateCollageVersionFromNames(
        selectedImages,
        params,
      )) as CollageGenerationResult & { task_id?: string };
      const newTaskId = response.task_id || null;
      if (!newTaskId) {
        setError("取得任務 ID 失敗");
        setLoading(false);
        return;
      }
      setTaskId(newTaskId);

      progressIntervalRef.current = setInterval(async () => {
        try {
          const progressData = (await getCollageProgress(newTaskId)) as CollageGenerationResult;
          setProgress(progressData.progress || 0);
          setProgressStage(progressData.stage || "");
          setProgressMessage(progressData.message || "");

          if (progressData.completed) {
            const timer = progressIntervalRef.current;
            if (timer) {
              clearInterval(timer);
            }
            progressIntervalRef.current = null;

            if (progressData.error) {
              setError(progressData.error);
              setLoading(false);
            } else {
              const imageUrl = `${apiBase}/generated_images/${progressData.output_image}`;
              setResult({
                ...progressData,
                imageUrl,
              });
              setLoading(false);
              setProgress(100);
            }
          }
        } catch (err) {
          // 保持輪詢但記錄錯誤
          console.error("Progress polling error:", err);
        }
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失敗";
      setError(message);
      setLoading(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  };

  return {
    loading,
    result,
    progress,
    progressStage,
    progressMessage,
    taskId,
    handleGenerate,
  };
}
