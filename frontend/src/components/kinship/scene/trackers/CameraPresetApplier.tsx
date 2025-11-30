import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import type { OrbitControls } from "three-stdlib";

import { CameraPreset } from "../../../../types/kinship";

interface CameraPresetApplierProps {
  preset?: CameraPreset | null;
}

export default function CameraPresetApplier({ preset }: CameraPresetApplierProps) {
  const controls = useThree((state) => state.controls as OrbitControls | undefined);
  const camera = useThree((state) => state.camera as THREE.PerspectiveCamera | undefined);

  useEffect(() => {
    if (!preset || !controls || !camera) return;
    const { position, target } = preset;
    if (position) {
      camera.position.set(position.x, position.y, position.z);
    }
    if (target) {
      controls.target.set(target.x, target.y, target.z);
    }
    controls.update();
  }, [preset, controls, camera]);

  return null;
}
