import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { useKinshipCapture } from "./hooks/useKinshipCapture.js";
import SceneClusters from "./scene/components/SceneClusters.jsx";
import IncubatorScene from "./scene/modes/IncubatorScene.jsx";
import PhylogenyScene from "./scene/modes/PhylogenyScene.jsx";
import CameraTracker from "./scene/trackers/CameraTracker.jsx";
import FpsTracker from "./scene/trackers/FpsTracker.jsx";
import CameraPresetApplier from "./scene/trackers/CameraPresetApplier.jsx";

export default function KinshipScene({
  imagesBase,
  clusters,
  data = null,
  phylogenyMode = false,
  incubatorMode = false,
  onPick,
  onFpsUpdate = () => {},
  onCameraUpdate = () => {},
  applyPreset = null,
  onCaptureReady = null,
}) {
  const { handleCreated } = useKinshipCapture(onCaptureReady);

  const cameraProps = useMemo(() => {
    if (phylogenyMode) return { fov: 50, position: [0, 0, 32] };
    if (incubatorMode) return { fov: 52, position: [0, 2.4, 24] };
    return { fov: 55, position: [0, 1.2, 15] };
  }, [phylogenyMode, incubatorMode]);

  const fogDensity = phylogenyMode ? 0.018 : incubatorMode ? 0.026 : 0.035;
  const ambientIntensity = phylogenyMode ? 1.1 : incubatorMode ? 1.05 : 0.9;
  const directionalIntensity = phylogenyMode ? 0.75 : incubatorMode ? 0.5 : 0.6;
  const minDistance = phylogenyMode ? 10 : incubatorMode ? 6 : 4;
  const maxDistance = phylogenyMode ? 80 : incubatorMode ? 48 : 60;

  return (
    <Canvas
      camera={cameraProps}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={handleCreated}
      style={{ width: "100%", height: "100%", background: "#000" }}
    >
      <fogExp2 attach="fog" args={[0x000000, fogDensity]} />
      <ambientLight intensity={ambientIntensity} />
      <directionalLight intensity={directionalIntensity} position={[5, 10, 7]} />
      {incubatorMode && (
        <pointLight intensity={1.2} position={[0, 3, 0]} color="#3fa9ff" distance={42} decay={2} />
      )}

      {phylogenyMode ? (
        <PhylogenyScene imagesBase={imagesBase} data={data} onPick={onPick} />
      ) : incubatorMode ? (
        <IncubatorScene imagesBase={imagesBase} data={data} onPick={onPick} />
      ) : (
        <SceneClusters imagesBase={imagesBase} clusters={clusters} onPick={onPick} />
      )}

      <OrbitControls enableDamping makeDefault minDistance={minDistance} maxDistance={maxDistance} enablePan />
      <FpsTracker onFpsUpdate={onFpsUpdate} />
      <CameraTracker onCameraUpdate={onCameraUpdate} />
      <CameraPresetApplier preset={applyPreset} />
    </Canvas>
  );
}
