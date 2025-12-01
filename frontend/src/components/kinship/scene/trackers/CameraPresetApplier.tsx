import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { KinshipCameraPreset } from "../../../../types/kinship";

export default function CameraPresetApplier({ preset }: { preset: KinshipCameraPreset | null }): null {
  const controls = useThree((state) => state.controls as OrbitControlsImpl | undefined);
  const camera = useThree((state) => state.camera);

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
