import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { useKinshipCapture } from "./hooks/useKinshipCapture.js";
import { useKinshipModeSelection } from "./hooks/useKinshipModeSelection.js";
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
  const { modeConfig } = useKinshipModeSelection({ phylogenyMode, incubatorMode });
  const {
    cameraProps,
    fogDensity,
    ambientIntensity,
    directionalIntensity,
    orbitControls,
    pointLightProps,
    SceneComponent,
    buildSceneProps,
  } = modeConfig;
  const sceneProps = buildSceneProps({ imagesBase, clusters, data, onPick });

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
      {pointLightProps && <pointLight {...pointLightProps} />}

      <SceneComponent {...sceneProps} />

      <OrbitControls
        enableDamping
        makeDefault
        minDistance={orbitControls.minDistance}
        maxDistance={orbitControls.maxDistance}
        enablePan
      />
      <FpsTracker onFpsUpdate={onFpsUpdate} />
      <CameraTracker onCameraUpdate={onCameraUpdate} />
      <CameraPresetApplier preset={applyPreset} />
    </Canvas>
  );
}
