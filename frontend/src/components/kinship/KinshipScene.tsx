import React from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { CameraPreset, KinshipCluster, KinshipData, KinshipOnPick } from "../../types/kinship";
import { useKinshipCapture } from "./hooks/useKinshipCapture";
import { useKinshipModeSelection } from "./hooks/useKinshipModeSelection";
import CameraTracker from "./scene/trackers/CameraTracker";
import FpsTracker from "./scene/trackers/FpsTracker";
import CameraPresetApplier from "./scene/trackers/CameraPresetApplier";

interface KinshipSceneProps {
  imagesBase: string;
  clusters?: KinshipCluster[];
  data?: KinshipData | null;
  phylogenyMode?: boolean;
  incubatorMode?: boolean;
  onPick?: KinshipOnPick;
  onFpsUpdate?: (fps: number) => void;
  onCameraUpdate?: (payload: CameraPreset) => void;
  applyPreset?: CameraPreset | null;
  onCaptureReady?: ((capture: ((...args: any[]) => Promise<Blob>) | null) => void) | null;
}

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
}: KinshipSceneProps) {
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
  const cameraOptions = {
    ...cameraProps,
    position: (cameraProps.position ?? [0, 0, 0]) as [number, number, number],
  } as any;
  const pointLightOptions = pointLightProps
    ? ({ ...pointLightProps, position: pointLightProps.position as [number, number, number] } as any)
    : null;

  return (
    <Canvas
      camera={cameraOptions}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={handleCreated}
      style={{ width: "100%", height: "100%", background: "#000" }}
    >
      <fogExp2 attach="fog" args={[0x000000, fogDensity]} />
      <ambientLight intensity={ambientIntensity} />
      <directionalLight intensity={directionalIntensity} position={[5, 10, 7]} />
      {pointLightOptions && <pointLight {...pointLightOptions} />}

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
