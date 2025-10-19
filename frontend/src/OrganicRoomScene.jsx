import React, { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
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

export default function OrganicRoomScene({ imagesBase, anchorImage, onSelectImage, showInfo = false }) {
  const anchorClean = cleanId(anchorImage);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);

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
              <CubeRoom faceUrls={faceUrls} />
            </Suspense>
          )}
          <OrbitControls
            enablePan={false}
            enableZoom
            minDistance={2.5}
            maxDistance={8}
            target={[0, -1.2, 0]}
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
