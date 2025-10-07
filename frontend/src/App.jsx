import React, { useEffect, useMemo, useState } from "react";
import { fetchKinship } from "./api.js";
import KinshipScene from "./ThreeKinshipScene.jsx";

const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";

export default function App() {
  const readParams = () => new URLSearchParams(window.location.search);
  const initialParams = useMemo(() => readParams(), []);
  const initialImg = initialParams.get("img");
  const [imgId, setImgId] = useState(initialImg);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [focus, setFocus] = useState(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (!imgId) return;
    fetchKinship(imgId, -1).then(setData).catch((e) => setErr(e.message));
  }, [imgId]);

  const navigateToImage = (nextImg) => {
    const params = readParams();
    params.set("img", nextImg);
    const qs = params.toString();
    window.history.replaceState(null, "", `?${qs}`);
    setImgId(nextImg);
  };

  // 自動向子代/兄弟/父母切換
  useEffect(() => {
    if (!data) return;
    const params = readParams();
    const autoplay = (params.get("autoplay") ?? "1") !== "0"; // 預設自動
    if (!autoplay) return;
    const stepSec = Math.max(2, parseInt(params.get("step") || "30"));

    // 記錄已看過避免重複
    const key = "visited_images";
    const visited = new Set(JSON.parse(sessionStorage.getItem(key) || "[]"));
    visited.add(data.original_image);

    const pickFirst = (arr) => arr.find((n) => n && !visited.has(n));
    let next = pickFirst(data.children || []);
    if (!next) next = pickFirst(data.siblings || []);
    if (!next) next = pickFirst(data.parents || []);
    if (!next) next = (data.children || [])[0] || (data.siblings || [])[0] || (data.parents || [])[0];

    sessionStorage.setItem(key, JSON.stringify(Array.from(visited)));

    if (!next) return;
    const t = setTimeout(() => navigateToImage(next), stepSec * 1000);
    return () => clearTimeout(t);
  }, [data]);

  // Ctrl+R toggle 左上角資訊（避免與瀏覽器刷新衝突：只攔截 Ctrl+R，不處理 Cmd+R/Meta+R）
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        setShowInfo((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!imgId) return <div style={{ padding: 16 }}>請在網址加上 ?img=檔名</div>;
  if (err) return <div style={{ padding: 16 }}>載入失敗：{err}</div>;

  const original = data?.original_image || imgId;
  const related = data?.related_images || [];
  const parents = data?.parents || [];
  const children = data?.children || [];
  const siblings = data?.siblings || [];
  const ancestors = data?.ancestors || [];
  const ancestorsByLevel = data?.ancestors_by_level || [];

  return (
    <>
      {showInfo && (
        <div className="topbar">
          <div className="badge">原圖：{original}</div>
          <div className="badge">關聯：{related.length} 張</div>
          <div className="badge">父母：{parents.length}</div>
          <div className="badge">子代：{children.length}</div>
          <div className="badge">兄弟姊妹：{siblings.length}</div>
          <div className="badge">祖先（去重）：{ancestors.length}</div>
        </div>
      )}
      <KinshipScene
        imagesBase={IMAGES_BASE}
        original={original}
        related={related}
        parents={parents}
        children={children}
        siblings={siblings}
        ancestorsByLevel={ancestorsByLevel}
        onPick={(n) => setFocus(n)}
      />
      <div className={`modal ${focus ? "open" : ""}`} onClick={() => setFocus(null)}>
        {focus && <img src={`${IMAGES_BASE}${focus}`} alt={focus} />}
      </div>
    </>
  );
}


