const API_BASE = import.meta.env.VITE_API_BASE || "";
export async function fetchKinship(img) {
  const url = `${API_BASE}/api/kinship?img=${encodeURIComponent(img)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}


