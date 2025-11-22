import { useCallback, useState } from "react";

export default function useGenerateParams() {
  const [prompt, setPrompt] = useState("");
  const [strength, setStrength] = useState(0.5);
  const [outputFormat, setOutputFormat] = useState("png");
  const [outputWidth, setOutputWidth] = useState("");
  const [outputHeight, setOutputHeight] = useState("");
  const [outputMaxSide, setOutputMaxSide] = useState("");
  const [resizeMode, setResizeMode] = useState("cover");
  const [count, setCount] = useState(2);

  const buildParams = useCallback(
    (selectedImages = []) => {
      const params = {};

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
    [count, outputFormat, outputHeight, outputMaxSide, outputWidth, prompt, resizeMode, strength]
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
