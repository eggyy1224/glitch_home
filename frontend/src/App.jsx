import React, { useEffect, useMemo, useState } from "react";
import { fetchKinship } from "./api.js";
import KinshipScene from "./ThreeKinshipScene.jsx";

const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const imgParam = params.get("img");
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    if (!imgParam) return;
    fetchKinship(imgParam).then(setData).catch((e) => setErr(e.message));
  }, [imgParam]);

  if (!imgParam) return <div style={{ padding: 16 }}>請在網址加上 ?img=檔名</div>;
  if (err) return <div style={{ padding: 16 }}>載入失敗：{err}</div>;

  const original = data?.original_image || imgParam;
  const related = data?.related_images || [];

  return (
    <>
      <div className="topbar">
        <div className="badge">原圖：{original}</div>
        <div className="badge">關聯：{related.length} 張</div>
      </div>
      <KinshipScene
        imagesBase={IMAGES_BASE}
        original={original}
        related={related}
        onPick={(n) => setFocus(n)}
      />
      <div className={`modal ${focus ? "open" : ""}`} onClick={() => setFocus(null)}>
        {focus && <img src={`${IMAGES_BASE}${focus}`} alt={focus} />}
      </div>
    </>
  );
}


