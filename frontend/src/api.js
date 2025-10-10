const API_BASE = import.meta.env.VITE_API_BASE || "";
export async function fetchKinship(img, depth = -1) {
  const url = `${API_BASE}/api/kinship?img=${encodeURIComponent(img)}&depth=${encodeURIComponent(depth)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function fetchCameraPresets() {
  const url = `${API_BASE}/api/camera-presets`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function saveCameraPreset(preset) {
  const url = `${API_BASE}/api/camera-presets`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preset),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function deleteCameraPreset(name) {
  const url = `${API_BASE}/api/camera-presets/${encodeURIComponent(name)}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return true;
}

