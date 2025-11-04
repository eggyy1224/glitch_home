import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

export default function CameraPresetApplier({ preset }) {
  const controls = useThree((state) => state.controls);
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
