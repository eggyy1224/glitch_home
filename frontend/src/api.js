const API_BASE = import.meta.env.VITE_API_BASE || "";
const IMAGES_BASE = import.meta.env.VITE_IMAGES_BASE || "/generated_images/";
export async function fetchKinship(img, depth = -1) {
  const url = `${API_BASE}/api/kinship?img=${encodeURIComponent(img)}&depth=${encodeURIComponent(depth)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function fetchClients() {
  const url = `${API_BASE}/api/clients`;
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

export async function fetchIframeConfigSnapshot(clientId = null) {
  let url = `${API_BASE}/api/iframe-config`;
  if (clientId) {
    const params = new URLSearchParams({ client: clientId });
    url = `${url}?${params.toString()}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function fetchCollageConfig(clientId = null) {
  let url = `${API_BASE}/api/collage-config`;
  if (clientId) {
    const params = new URLSearchParams({ client: clientId });
    url = `${url}?${params.toString()}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function pushIframeConfig(rawConfig, targetClientId = null) {
  if (!rawConfig || typeof rawConfig !== "object") {
    throw new Error("缺少 iframe 設定內容");
  }
  const payload = { ...rawConfig };
  if (targetClientId) {
    payload.target_client_id = targetClientId;
  }
  const res = await fetch(`${API_BASE}/api/iframe-config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function pushCollageConfig(config, targetClientId = null) {
  if (!config || typeof config !== "object") {
    throw new Error("缺少拼貼設定內容");
  }
  const payload = { ...config };
  if (targetClientId) {
    payload.target_client_id = targetClientId;
  }
  const res = await fetch(`${API_BASE}/api/collage-config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function saveCollageConfig(config) {
  const url = `${API_BASE}/api/collage-config`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
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

export async function pushSubtitleState(subtitle, targetClientId) {
  if (!subtitle || !subtitle.text) {
    throw new Error("目前沒有可推播的字幕");
  }
  let url = `${API_BASE}/api/subtitles`;
  if (targetClientId) {
    const params = new URLSearchParams({ target_client_id: targetClientId });
    url = `${url}?${params.toString()}`;
  }
  const payload = {
    text: subtitle.text,
  };
  if (subtitle.language) {
    payload.language = subtitle.language;
  }
  if (typeof subtitle.duration_seconds === "number") {
    payload.duration_seconds = subtitle.duration_seconds;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
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

export async function pushCaptionState(caption, targetClientId) {
  if (!caption || !caption.text) {
    throw new Error("目前沒有可推播的字幕標題");
  }
  let url = `${API_BASE}/api/captions`;
  if (targetClientId) {
    const params = new URLSearchParams({ target_client_id: targetClientId });
    url = `${url}?${params.toString()}`;
  }
  const payload = {
    text: caption.text,
  };
  if (caption.language) {
    payload.language = caption.language;
  }
  if (typeof caption.duration_seconds === "number") {
    payload.duration_seconds = caption.duration_seconds;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function generateCollageVersion(files, params) {
  const url = `${API_BASE}/api/generate-collage-version`;
  const formData = new FormData();
  
  // Add files
  for (const file of files) {
    formData.append("files", file);
  }
  
  // Add params as JSON string
  formData.append("params", JSON.stringify(params));
  
  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API ${res.status}: ${errorText}`);
  }
  
  const result = await res.json();
  
  // Build image URL
  const imageUrl = `${API_BASE}/generated_images/${result.output_image}`;
  
  return {
    ...result,
    imageUrl,
  };
}

export async function listOffspringImages() {
  const url = `${API_BASE}/api/offspring-images`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

export async function generateCollageVersionFromNames(imageNames, params) {
  const url = `${API_BASE}/api/generate-collage-version`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_names: imageNames,
      ...params,
    }),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API ${res.status}: ${errorText}`);
  }
  
  const result = await res.json();
  
  return result;
}

export async function getCollageProgress(taskId) {
  const url = `${API_BASE}/api/collage-version/${taskId}/progress`;
  const res = await fetch(url);
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API ${res.status}: ${errorText}`);
  }
  
  return res.json();
}

export async function generateMixTwo(params) {
  const url = `${API_BASE}/api/generate/mix-two`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API ${res.status}: ${errorText}`);
  }
  
  const result = await res.json();
  
  // Build image URL from output_image_path
  // output_image_path is a full path like "backend/offspring_images/offspring_xxx.png"
  // We need to extract just the filename
  const imageFilename = result.output_image_path?.split("/").pop() || result.output_image;
  const normalizedBase = IMAGES_BASE.endsWith("/") ? IMAGES_BASE : `${IMAGES_BASE}/`;
  const imageUrl = imageFilename ? `${normalizedBase}${imageFilename}` : null;
  
  return {
    ...result,
    imageUrl,
  };
}
