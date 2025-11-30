import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";

import { CameraPreset } from "../../../../types/kinship";

interface CameraTrackerProps {
  onCameraUpdate?: (payload: CameraPreset) => void;
}

export default function CameraTracker({ onCameraUpdate }: CameraTrackerProps) {
  const controls = useThree((state) => state.controls as OrbitControls | undefined);
  const camera = useThree((state) => state.camera as THREE.PerspectiveCamera | undefined);
  const callbackRef = useRef<typeof onCameraUpdate>(onCameraUpdate);
  const lastPayload = useRef<CameraPreset | null>(null);

  useEffect(() => {
    callbackRef.current = onCameraUpdate;
  }, [onCameraUpdate]);

  useEffect(() => {
    if (!controls || !camera) return;
    const emit = () => {
      const pos = camera.position;
      const target = controls.target;
      const payload = {
        position: { x: pos.x, y: pos.y, z: pos.z },
        target: { x: target.x, y: target.y, z: target.z },
      };
      const prev = lastPayload.current;
      const changed =
        !prev ||
        Math.abs(prev.position.x - payload.position.x) > 0.01 ||
        Math.abs(prev.position.y - payload.position.y) > 0.01 ||
        Math.abs(prev.position.z - payload.position.z) > 0.01 ||
        Math.abs(prev.target.x - payload.target.x) > 0.01 ||
        Math.abs(prev.target.y - payload.target.y) > 0.01 ||
        Math.abs(prev.target.z - payload.target.z) > 0.01;
      if (changed) {
        lastPayload.current = payload;
        callbackRef.current?.(payload);
      }
    };
    controls.addEventListener("change", emit);
    emit();
    return () => controls.removeEventListener("change", emit);
  }, [controls, camera]);

  return null;
}
