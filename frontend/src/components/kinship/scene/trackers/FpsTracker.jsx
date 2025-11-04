import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";

export default function FpsTracker({ onFpsUpdate }) {
  const frameCount = useRef(0);
  const timeAccum = useRef(0);
  const lastReported = useRef(null);
  const callbackRef = useRef(onFpsUpdate);

  useEffect(() => {
    callbackRef.current = onFpsUpdate;
  }, [onFpsUpdate]);

  useFrame((_, delta) => {
    frameCount.current += 1;
    timeAccum.current += delta;
    if (timeAccum.current >= 0.5) {
      const fpsRaw = frameCount.current / timeAccum.current;
      frameCount.current = 0;
      timeAccum.current = 0;
      const rounded = Math.round(fpsRaw * 10) / 10;
      if (lastReported.current !== rounded) {
        lastReported.current = rounded;
        callbackRef.current?.(rounded);
      }
    }
  });

  return null;
}
