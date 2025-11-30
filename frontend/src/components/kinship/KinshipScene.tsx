import React from "react";
import * as THREE from "three";
import { Canvas, type ThreeElements } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import type {
  KinshipCameraPose,
  KinshipCameraPreset,
  KinshipCluster,
  KinshipData,
} from "../../types/kinship";
import { useKinshipCapture } from "./hooks/useKinshipCapture";
import { useKinshipModeSelection } from "./hooks/useKinshipModeSelection";
import CameraTracker from "./scene/trackers/CameraTracker";
import FpsTracker from "./scene/trackers/FpsTracker";
import CameraPresetApplier from "./scene/trackers/CameraPresetApplier";

interface KinshipModeConfig {
  cameraProps: React.ComponentProps<typeof Canvas>["camera"];
  fogDensity: number;
  ambientIntensity: number;
  directionalIntensity: number;
  orbitControls: { minDistance: number; maxDistance: number };
  pointLightProps?: ThreeElements["pointLight"];
  SceneComponent: React.ComponentType<Record<string, unknown>>;
  buildSceneProps: (args: {
    imagesBase: string;
    clusters?: KinshipCluster[];
    data?: KinshipData | null;
    onPick?: (name: string) => void;
  }) => Record<string, unknown>;
}

interface KinshipSceneProps {
  imagesBase: string;
  clusters?: KinshipCluster[];
  data?: KinshipData | null;
  phylogenyMode?: boolean;
  incubatorMode?: boolean;
  onPick?: (name: string) => void;
  onFpsUpdate?: (fps: number) => void;
  onCameraUpdate?: (payload: KinshipCameraPose) => void;
  applyPreset?: KinshipCameraPreset | null;
  onCaptureReady?: (capture: ((options?: unknown) => Promise<Blob>) | null) => void;
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
  const { modeConfig } = useKinshipModeSelection({ phylogenyMode, incubatorMode }) as unknown as {
    modeConfig: KinshipModeConfig;
  };
  const {
    cameraProps: rawCameraProps,
    fogDensity,
    ambientIntensity,
    directionalIntensity,
    orbitControls,
    pointLightProps: rawPointLightProps,
    SceneComponent,
    buildSceneProps,
  } = modeConfig;
  const cameraProps = rawCameraProps as React.ComponentProps<typeof Canvas>["camera"];
  const pointLightProps = rawPointLightProps as ThreeElements["pointLight"] | undefined;
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
