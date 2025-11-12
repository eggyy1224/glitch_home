const API_BASE = import.meta.env.VITE_API_BASE || "";

function buildTargetQuery(targetClientId, paramName = "target_client_id") {
  if (targetClientId == null) {
    return "";
  }
  const trimmed = `${targetClientId}`.trim();
  if (!trimmed) {
    return "";
  }
  return `?${paramName}=${encodeURIComponent(trimmed)}`;
}

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

export async function fetchClients() {
  const url = `${API_BASE}/api/clients`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function pushDisplayState(payload, targetClientId = null) {
  if (!payload || typeof payload.mode !== "string") {
    throw new Error("display payload 需包含 mode");
  }
  const body = {
    mode: payload.mode,
    params: payload.params ?? {},
    frames: Array.isArray(payload.frames)
      ? payload.frames.map((frame) => ({
          id: frame.id,
          label: frame.label ?? null,
          mode: frame.mode ?? null,
          params: frame.params ?? {},
        }))
      : [],
  };
  if (payload.expires_in != null) {
    body.expires_in = payload.expires_in;
  }
  const query = buildTargetQuery(targetClientId);
  const url = `${API_BASE}/api/display${query}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function pushContainerLayout(rawConfig, targetClientId = null) {
  if (!rawConfig || typeof rawConfig !== "object") {
    throw new Error("container layout payload 必須為物件");
  }
  const payload = {
    ...rawConfig,
  };
  const queryTarget = targetClientId == null ? null : `${targetClientId}`.trim();
  if (queryTarget) {
    payload.target_client_id = queryTarget;
  } else {
    delete payload.target_client_id;
  }
  const url = `${API_BASE}/api/container-layout`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

function sanitizeSubtitlePayload(payload) {
  if (!payload || typeof payload.text !== "string" || !payload.text.trim()) {
    throw new Error("字幕內容不可為空");
  }
  return {
    text: payload.text,
    language: payload.language ?? null,
    duration_seconds: payload.duration_seconds ?? null,
  };
}

export async function pushSubtitle(payload, targetClientId = null) {
  const body = sanitizeSubtitlePayload(payload);
  const query = buildTargetQuery(targetClientId, "target_client_id");
  const url = `${API_BASE}/api/subtitles${query}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function clearSubtitle(targetClientId = null) {
  const query = buildTargetQuery(targetClientId, "target_client_id");
  const url = `${API_BASE}/api/subtitles${query}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return true;
}

export async function pushCaption(payload, targetClientId = null) {
  const body = sanitizeSubtitlePayload(payload);
  const query = buildTargetQuery(targetClientId, "target_client_id");
  const url = `${API_BASE}/api/captions${query}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function clearCaption(targetClientId = null) {
  const query = buildTargetQuery(targetClientId, "target_client_id");
  const url = `${API_BASE}/api/captions${query}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return true;
}
