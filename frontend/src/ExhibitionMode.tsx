import React, { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import CameraTracker from "./components/kinship/scene/trackers/CameraTracker";
import CameraPresetApplier from "./components/kinship/scene/trackers/CameraPresetApplier";
import type { KinshipCameraPose, KinshipCameraPreset } from "./types/kinship";

type ExhibitionModeProps = {
  onCaptureReady?: (capture: (() => Promise<Blob>) | null) => void;
  onCameraUpdate?: (payload: KinshipCameraPose) => void;
  applyPreset?: KinshipCameraPreset | null;
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    width: "100vw",
    height: "100vh",
    background: "radial-gradient(circle at 20% 20%, #11182a 0%, #05070f 55%, #02030a 100%)",
    color: "#e7ecff",
    overflow: "hidden",
    fontFamily: "'Space Grotesk', 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
  },
  overlay: {
    position: "absolute",
    top: "32px",
    left: "32px",
    padding: "16px 18px",
    borderRadius: "14px",
    background: "rgba(7, 10, 18, 0.64)",
    border: "1px solid rgba(120, 148, 255, 0.25)",
    boxShadow: "0 14px 32px rgba(0, 0, 0, 0.5)",
    maxWidth: "360px",
    zIndex: 2,
  },
  kicker: {
    margin: "0 0 6px",
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    fontSize: "11px",
    color: "#8fb3ff",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "26px",
    letterSpacing: "0.04em",
  },
  desc: {
    margin: 0,
    fontSize: "13px",
    lineHeight: 1.6,
    color: "#c6cee8",
  },
  hint: {
    margin: "10px 0 0",
    fontSize: "12px",
    letterSpacing: "0.04em",
    color: "#7ad8ff",
  },
  loading: {
    color: "#c8d2ff",
    fontSize: "14px",
    letterSpacing: "0.08em",
  },
};

function GlitchSculpture() {
  const { scene } = useGLTF("/glb/glitch_3F.glb");

  const preparedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      const obj = child as THREE.Object3D & { castShadow?: boolean; receiveShadow?: boolean };
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
    return clone;
  }, [scene]);

  return <primitive object={preparedScene} position={[0, -0.4, 0]} />;
}

useGLTF.preload("/glb/glitch_3F.glb");

export default function ExhibitionMode({ onCaptureReady, onCameraUpdate, applyPreset }: ExhibitionModeProps) {
  return (
    <div style={styles.page}>
      <div style={styles.overlay}>
        <p style={styles.kicker}>Exhibition Mode</p>
        <h1 style={styles.title}>glitch_3F</h1>
        <p style={styles.desc}>將 3F 模型置入靜謐的暗色展場，使用滑鼠旋轉或縮放，從不同視角感受雕塑的體積與材質。</p>
        <p style={styles.hint}>拖曳旋轉 • 滾輪縮放 • 按住 Shift 快速平移</p>
      </div>
      <Canvas shadows dpr={[1, 2]} camera={{ position: [2.8, 1.9, 3.1], fov: 38 }}>
        <color attach="background" args={["#04060d"]} />
        <fog attach="fog" args={["#04060d", 8, 18]} />
        <hemisphereLight intensity={0.75} color="#ffe3c4" groundColor="#0a0f24" />
        <directionalLight
          position={[6, 8, 6]}
          intensity={1.45}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={0.5}
          shadow-camera-far={25}
        />
        <spotLight position={[-5, 6, -3]} angle={0.6} penumbra={0.4} intensity={0.9} color="#7acbff" />
        <Suspense
          fallback={
            <Html center>
              <div style={styles.loading}>載入模型中…</div>
            </Html>
          }
        >
          <group position={[0, -0.2, 0]}>
            <GlitchSculpture />
          </group>
          <ContactShadows
            position={[0, -0.7, 0]}
            opacity={0.35}
            width={8}
            height={8}
            blur={1.8}
            far={8}
            color="#0b0d12"
          />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls
          enablePan
          enableZoom
          target={[0, 0.35, 0]}
          maxDistance={9}
          minDistance={1.8}
          maxPolarAngle={Math.PI * 0.9}
          dampingFactor={0.12}
          enableDamping
          makeDefault
        />
        <CameraTracker onCameraUpdate={onCameraUpdate} />
        <CameraPresetApplier preset={applyPreset} />
      </Canvas>
    </div>
  );
}
