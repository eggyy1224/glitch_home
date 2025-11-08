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
