import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { searchImagesByImage } from "./api.js";

const styles = {
  root: {
    position: "relative",
    width: "100vw",
    height: "100vh",
    background: "radial-gradient(circle at top, #1e1e2f 0%, #050509 65%, #000 100%)",
    color: "#f5f5f5",
    overflow: "hidden",
    fontFamily: "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
  },
  canvasOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  infoPanel: {
    position: "absolute",
    top: "24px",
    left: "24px",
    maxWidth: "320px",
    padding: "16px",
    borderRadius: "12px",
    background: "rgba(10, 10, 16, 0.72)",
    backdropFilter: "blur(12px)",
    boxShadow: "0 18px 38px rgba(0,0,0,0.45)",
  },
  panelTitle: {
    margin: "0 0 8px",
    fontSize: "20px",
    letterSpacing: "0.04em",
  },
  anchorLabel: {
    margin: "0 0 12px",
    fontSize: "13px",
    color: "#a9b4ff",
  },
  status: {
    margin: "0 0 12px",
    fontSize: "14px",
  },
  error: {
    margin: "0 0 12px",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "rgba(160,30,50,0.25)",
    border: "1px solid rgba(255,70,95,0.4)",
    color: "#ffb3c1",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  listItem: {
    display: "flex",
    flexDirection: "column",
    padding: "10px 12px",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.06)",
    cursor: "pointer",
    transition: "transform 0.2s ease, border 0.2s ease",
  },
  listItemActive: {
    border: "1px solid rgba(144,180,255,0.75)",
    background: "rgba(66,95,255,0.22)",
  },
  listItemTitle: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 600,
    color: "#fdfdfd",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  listItemMeta: {
    margin: "4px 0 0",
    fontSize: "12px",
    color: "#b7c0ff",
  },
  empty: {
    margin: 0,
    fontSize: "13px",
    color: "#bdbdbd",
  },
};

const cleanId = (value) => (value ? value.replace(/:(en|zh)$/, "") : value);

const HALF_ROOM_SIZE = 6;
const FACE_NORMALS = [
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(0, 0, -1),
];
const FACE_CENTERS = FACE_NORMALS.map((normal) => normal.clone().multiplyScalar(HALF_ROOM_SIZE));
const TMP_VEC_A = new THREE.Vector3();
const TMP_VEC_B = new THREE.Vector3();
const TMP_VEC_C = new THREE.Vector3();
const TMP_VEC_D = new THREE.Vector3();
const TMP_VEC_E = new THREE.Vector3();

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function CubeRoom({ faceUrls }) {
  const textures = useTexture(faceUrls);

  useEffect(() => {
    textures.forEach((texture) => {
      if (!texture) return;
      texture.anisotropy = 8;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.colorSpace = THREE.SRGBColorSpace;
    });
    return () => {
      textures.forEach((texture) => {
        texture?.dispose?.();
      });
    };
  }, [textures]);

  return (
    <mesh>
      <boxGeometry args={[12, 12, 12]} />
      {textures.map((texture, index) => (
        <meshBasicMaterial
          key={index}
          attach={`material-${index}`}
          map={texture}
          side={THREE.BackSide}
          toneMapped={false}
        />
      ))}
    </mesh>
  );
}

function OrganicCube({ faceUrls, enabled }) {
  const groupRef = useRef();
  const phaseRef = useRef(0);
  useFrame((_, delta) => {
    const ref = groupRef.current;
    if (!ref) return;
    if (!enabled) return;
    phaseRef.current += delta;
    const t = phaseRef.current;
    ref.rotation.x = Math.sin(t * 0.24) * 0.18 + Math.sin(t * 0.09) * 0.05;
    ref.rotation.y = Math.sin(t * 0.17) * 0.12 + Math.cos(t * 0.11) * 0.06;
    ref.rotation.z = Math.cos(t * 0.21) * 0.14 + Math.sin(t * 0.13) * 0.05;
  });
  return (
    <group ref={groupRef}>
      <CubeRoom faceUrls={faceUrls} />
    </group>
  );
}

function OrganicCruise({ enabled, controlsRef, faceIds, onEnterFace }) {
  const { camera } = useThree();
  const cycleRef = useRef({
    time: 0,
    index: 0,
    triggered: false,
  });

  useEffect(() => {
    cycleRef.current = { time: 0, index: 0, triggered: false };
  }, [faceIds]);

  useFrame((_, delta) => {
    if (!enabled || !faceIds.length) {
      return;
    }

    const cycle = cycleRef.current;
    cycle.time += delta;
    const cycleDuration = 24;
    if (cycle.time >= cycleDuration) {
      cycle.time -= cycleDuration;
      cycle.index = (cycle.index + 1) % faceIds.length;
      cycle.triggered = false;
    }

    const progress = cycle.time / cycleDuration;
    const wanderPos = TMP_VEC_A.set(
      Math.cos(cycle.time * 0.22) * 3.2,
      Math.sin(cycle.time * 0.17) * 0.55,
      Math.sin(cycle.time * 0.19) * 2.9
    );

    const targetLook = TMP_VEC_B.set(
      Math.sin(cycle.time * 0.28) * 0.45,
      -1.2 + Math.sin(cycle.time * 0.41) * 0.28,
      Math.cos(cycle.time * 0.25) * 0.45
    );

    let desiredPos = TMP_VEC_E.copy(wanderPos);
    const approachStart = 0.62;
    const approachEnd = 0.94;
    const faceIndex = cycle.index % faceIds.length;

    if (progress > approachStart) {
      const normal = FACE_NORMALS[faceIndex];
      const center = FACE_CENTERS[faceIndex];
      const approachPoint = TMP_VEC_C.copy(center).sub(TMP_VEC_D.copy(normal).multiplyScalar(1.4));
      const p = THREE.MathUtils.clamp((progress - approachStart) / (approachEnd - approachStart), 0, 1);
      const eased = easeInOutCubic(p);
      desiredPos = TMP_VEC_E.copy(wanderPos).lerp(approachPoint, eased);
      targetLook.lerp(TMP_VEC_D.copy(center).multiplyScalar(0.2), 0.6);

      if (p > 0.98 && !cycle.triggered && onEnterFace) {
        cycle.triggered = true;
        onEnterFace(faceIds[faceIndex]);
      }
    }

    camera.position.lerp(desiredPos, 0.12);
    camera.lookAt(targetLook);
    if (controlsRef?.current) {
      controlsRef.current.target.lerp(targetLook, 0.12);
      controlsRef.current.update();
    }
  });

  return null;
}

export default function OrganicRoomScene({ imagesBase, anchorImage, onSelectImage, showInfo = false }) {
  const anchorClean = cleanId(anchorImage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const controlsRef = useRef(null);
  const motionEnabled = !showInfo;

  useEffect(() => {
    if (!anchorClean) {
      setResults([]);
      setLoading(false);
      setError("請在網址加入 ?img=offspring_xxx.png 以決定房間素材。");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const searchPath = `backend/offspring_images/${anchorClean}`;
    searchImagesByImage(searchPath, 6)
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.results) ? data.results : [];
        const prepared = list
          .map((item) => ({
            id: item?.id || "",
            cleanId: cleanId(item?.id || ""),
            distance: typeof item?.distance === "number" ? item.distance : null,
            metadata: item?.metadata ?? null,
          }))
          .filter((item) => item.cleanId);
        setResults(prepared.slice(0, 6));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "搜尋失敗，請確認後端服務狀態。");
        setResults([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [anchorClean]);

  const faceIds = useMemo(() => {
    const ordered = [];
    if (anchorClean) ordered.push(anchorClean);
    results.forEach((item) => {
      if (item.cleanId && !ordered.includes(item.cleanId)) {
        ordered.push(item.cleanId);
      }
    });
    const truncated = ordered.slice(0, 6);
    if (truncated.length === 0) {
      return [];
    }
    const filled = [...truncated];
    const baseCount = truncated.length;
    while (filled.length < 6) {
      filled.push(truncated[filled.length % baseCount]);
    }
    return filled;
  }, [anchorClean, results]);

  const faceUrls = useMemo(() => faceIds.map((id) => `${imagesBase}${id}`), [faceIds, imagesBase]);
  const ready = faceUrls.length === 6 && faceUrls.every(Boolean);
  const motionActive = motionEnabled && ready;

  const handleEnterFace = useCallback(
    (faceId) => {
      if (!faceId || !onSelectImage) return;
      const clean = cleanId(faceId);
      if (clean === anchorClean) return;
      onSelectImage(clean);
    },
    [anchorClean, onSelectImage]
  );

  return (
    <div style={styles.root}>
      <div style={styles.canvasOverlay}>
        <Canvas camera={{ position: [0, 0, 4.6], fov: 58 }}>
          <color attach="background" args={["#050509"]} />
          <ambientLight intensity={0.8} />
          <pointLight position={[0, 4, 0]} intensity={1.2} color={0x7c9bff} />
          <pointLight position={[3, -2, 2]} intensity={0.8} color={0xff6f91} />
          {ready && (
            <Suspense fallback={null}>
              <OrganicCube faceUrls={faceUrls} enabled={motionActive} />
            </Suspense>
          )}
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            enableZoom
            minDistance={2.5}
            maxDistance={8}
            target={[0, -1.2, 0]}
          />
          <OrganicCruise
            enabled={motionActive}
            controlsRef={controlsRef}
            faceIds={faceIds}
            onEnterFace={handleEnterFace}
          />
        </Canvas>
      </div>

      {showInfo && (
        <aside style={styles.infoPanel}>
          <h2 style={styles.panelTitle}>Organic Room</h2>
          <p style={styles.anchorLabel}>錨點圖像：{anchorClean || "未指定"}</p>
          {loading && <p style={styles.status}>正在載入相似影像...</p>}
          {error && <p style={styles.error}>{error}</p>}
          {!loading && !error && results.length === 0 && (
            <p style={styles.empty}>尚未取得可用的相似影像。</p>
          )}
          {results.length > 0 && (
            <ul style={styles.list}>
              {results.map((item, idx) => {
                const isAnchor = item.cleanId === anchorClean;
                const distance = item.distance;
                const similarity = distance != null ? Math.max(0, ((1 - distance / 2) * 100)).toFixed(0) : null;
                return (
                  <li
                    key={`${item.cleanId}-${idx}`}
                    style={{
                      ...styles.listItem,
                      ...(isAnchor ? styles.listItemActive : {}),
                    }}
                    onClick={() => {
                      if (item.cleanId && onSelectImage) {
                        onSelectImage(item.cleanId);
                      }
                    }}
                    onMouseEnter={(evt) => {
                      evt.currentTarget.style.transform = "translateY(-2px)";
                      evt.currentTarget.style.border = "1px solid rgba(160,180,255,0.55)";
                    }}
                    onMouseLeave={(evt) => {
                      evt.currentTarget.style.transform = "translateY(0)";
                      evt.currentTarget.style.border = `1px solid ${isAnchor ? "rgba(144,180,255,0.75)" : "rgba(255,255,255,0.06)"}`;
                    }}
                  >
                    <p style={styles.listItemTitle}>{item.cleanId}</p>
                    <p style={styles.listItemMeta}>
                      {similarity !== null ? `相似度：約 ${similarity}%` : "相似度未知"}
                      {distance !== null ? ` · 距離 ${distance.toFixed(3)}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      )}
    </div>
  );
}
