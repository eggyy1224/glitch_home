import { useCallback, useState } from "react";
import type { GenerateMixTwoParams } from "../types/generate";

type GenerateParamsState = {
  prompt: string;
  strength: number;
  outputFormat: string;
  outputWidth: string;
  outputHeight: string;
  outputMaxSide: string;
  resizeMode: string;
  count: number;
};

const INITIAL_STATE: GenerateParamsState = {
  prompt: "",
  strength: 0.5,
  outputFormat: "png",
  outputWidth: "",
  outputHeight: "",
  outputMaxSide: "",
  resizeMode: "cover",
  count: 2,
};

export default function useGenerateParams() {
  const [prompt, setPrompt] = useState(INITIAL_STATE.prompt);
  const [strength, setStrength] = useState(INITIAL_STATE.strength);
  const [outputFormat, setOutputFormat] = useState(INITIAL_STATE.outputFormat);
  const [outputWidth, setOutputWidth] = useState(INITIAL_STATE.outputWidth);
  const [outputHeight, setOutputHeight] = useState(INITIAL_STATE.outputHeight);
  const [outputMaxSide, setOutputMaxSide] = useState(INITIAL_STATE.outputMaxSide);
  const [resizeMode, setResizeMode] = useState(INITIAL_STATE.resizeMode);
  const [count, setCount] = useState(INITIAL_STATE.count);

  const buildParams = useCallback(
    (selectedImages: string[] = []): GenerateMixTwoParams => {
      const params: GenerateMixTwoParams = {};

      if (selectedImages.length >= 2) {
        params.parents = selectedImages;
      } else {
        params.count = count;
      }

      const trimmedPrompt = prompt.trim();
      if (trimmedPrompt) {
        params.prompt = trimmedPrompt;
      }

      if (strength !== null && strength !== undefined) {
        params.strength = strength;
      }
      if (outputFormat) {
        params.output_format = outputFormat;
      }
      if (outputWidth) {
        params.output_width = parseInt(outputWidth, 10);
      }
      if (outputHeight) {
        params.output_height = parseInt(outputHeight, 10);
      }
      if (outputMaxSide) {
        params.output_max_side = parseInt(outputMaxSide, 10);
      }
      if (resizeMode) {
        params.resize_mode = resizeMode;
      }

      return params;
    },
    [count, outputFormat, outputHeight, outputMaxSide, outputWidth, prompt, resizeMode, strength],
  );

  return {
    prompt,
    setPrompt,
    strength,
    setStrength,
    outputFormat,
    setOutputFormat,
    outputWidth,
    setOutputWidth,
    outputHeight,
    setOutputHeight,
    outputMaxSide,
    setOutputMaxSide,
    resizeMode,
    setResizeMode,
    count,
    setCount,
    buildParams,
  };
}
