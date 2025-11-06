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

export async function uploadScreenshot(blob, requestId = null, clientId = null) {
  const url = `${API_BASE}/api/screenshots`;
  const form = new FormData();
  const filename = `scene-${Date.now()}.png`;
  form.append("file", blob, filename);
  if (requestId) {
    form.append("request_id", requestId);
  }
  if (clientId) {
    form.append("client_id", clientId);
  }
  const res = await fetch(url, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function reportScreenshotFailure(requestId, errorMessage = "", clientId = null) {
  const url = `${API_BASE}/api/screenshots/${encodeURIComponent(requestId)}/fail`;
  const payload = { error: errorMessage };
  if (clientId) {
    payload.client_id = clientId;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// 以圖搜圖 API
export async function searchImagesByImage(imagePath, topK = 10) {
  const url = `${API_BASE}/api/search/image`;
  const payload = {
    image_path: imagePath,
    top_k: topK,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

// 文字搜尋 API
export async function searchImagesByText(query, topK = 10) {
  const url = `${API_BASE}/api/search/text`;
  const payload = {
    query,
    top_k: topK,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function fetchSoundFiles() {
  const url = `${API_BASE}/api/sound-files`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data?.files) ? data.files : [];
  const requestUrl = new URL(res.url);
  const mapped = list.map((file) => {
    if (!file?.url) return file;
    try {
      const href = String(file.url);
      const absolute = new URL(href, requestUrl.origin);
      // Encode pathname segments to avoid issues with spaces or unicode.
      const encodedPath = absolute.pathname
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
      absolute.pathname = encodedPath;
      return {
        ...file,
        url: absolute.toString(),
      };
    } catch (err) {
      return file;
    }
  });
  return { files: mapped };
}

export async function fetchSubtitleState(clientId = null) {
  let url = `${API_BASE}/api/subtitles`;
  if (clientId) {
    const params = new URLSearchParams({ client: clientId });
    url = `${url}?${params.toString()}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return {
    subtitle: data?.subtitle ?? null,
  };
}

export async function fetchCaptionState(clientId = null) {
  let url = `${API_BASE}/api/captions`;
  if (clientId) {
    const params = new URLSearchParams({ client: clientId });
    url = `${url}?${params.toString()}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  const data = await res.json();
  return {
    caption: data?.caption ?? null,
  };
}

export async function fetchDisplayState(clientId = null, { fallbackToGlobal = true } = {}) {
  const baseUrl = `${API_BASE}/api/display`;
  // 若提供 clientId，先嘗試抓取該 client 的狀態；若為 null 且允許 fallback，再抓全域
  if (clientId) {
    const params = new URLSearchParams({ client: clientId });
    const targetedUrl = `${baseUrl}?${params.toString()}`;
    const res = await fetch(targetedUrl);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = await res.json();
    if (fallbackToGlobal && (json?.state == null)) {
      const res2 = await fetch(baseUrl);
      if (!res2.ok) throw new Error(`API ${res2.status}`);
      return res2.json();
    }
    return json;
  }
  // 未提供 clientId → 直接抓全域
  const res = await fetch(baseUrl);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}
