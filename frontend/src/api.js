import { API_BASE, IMAGES_BASE, buildImageUrl, request } from "./utils/request";
export async function fetchKinship(img, depth = -1, { signal } = {}) {
  const url = `/api/kinship?img=${encodeURIComponent(img)}&depth=${encodeURIComponent(depth)}`;
  return request(url, { signal });
}

export async function fetchCameraPresets({ signal } = {}) {
  const url = `/api/camera-presets`;
  return request(url, { signal });
}

export async function saveCameraPreset(preset) {
  const url = `/api/camera-presets`;
  return request(url, { method: "POST", body: preset });
}

export async function deleteCameraPreset(name) {
  const url = `/api/camera-presets/${encodeURIComponent(name)}`;
  await request(url, { method: "DELETE" });
  return true;
}

export async function fetchCollageConfig(clientId = null, { signal } = {}) {
  let url = `/api/collage-config`;
  if (clientId) {
    const params = new URLSearchParams({ client: clientId });
    url = `${url}?${params.toString()}`;
  }
  return request(url, { signal });
}

export async function fetchIframeTimeline(timelineId, { signal, resolve = true } = {}) {
  if (!timelineId) {
    throw new Error("timelineId is required");
  }
  const params = resolve === false ? "?resolve=false" : "";
  const url = `/api/iframe-timelines/${encodeURIComponent(timelineId)}${params}`;
  return request(url, { signal });
}

export async function listIframeTimelines(clientId = null, { signal } = {}) {
  let url = `/api/iframe-timelines`;
  if (clientId) {
    const qs = new URLSearchParams({ client: clientId });
    url = `${url}?${qs.toString()}`;
  }
  return request(url, { signal });
}

export async function fetchEpisode(episodeId, { signal, resolve = true } = {}) {
  if (!episodeId) {
    throw new Error("episodeId is required");
  }
  const params = resolve === false ? "?resolve=false" : "";
  const url = `/api/episodes/${encodeURIComponent(episodeId)}${params}`;
  return request(url, { signal });
}

export async function listEpisodes({ signal } = {}) {
  const url = `/api/episodes`;
  return request(url, { signal });
}

export async function saveCollageConfig(config) {
  const url = `/api/collage-config`;
  return request(url, { method: "PUT", body: config });
}

export async function uploadScreenshot(blob, requestId = null, clientId = null) {
  const url = `/api/screenshots`;
  const form = new FormData();
  const filename = `scene-${Date.now()}.png`;
  form.append("file", blob, filename);
  if (requestId) {
    form.append("request_id", requestId);
  }
  if (clientId) {
    form.append("client_id", clientId);
  }
  return request(url, { method: "POST", body: form });
}

export async function reportScreenshotFailure(requestId, errorMessage = "", clientId = null) {
  const url = `/api/screenshots/${encodeURIComponent(requestId)}/fail`;
  const payload = { error: errorMessage };
  if (clientId) {
    payload.client_id = clientId;
  }
  return request(url, { method: "POST", body: payload });
}

// 以圖搜圖 API
export async function searchImagesByImage(imagePath, topK = 10, { signal } = {}) {
  const url = `/api/search/image`;
  const payload = {
    image_path: imagePath,
    top_k: topK,
  };
  return request(url, { method: "POST", body: payload, signal });
}

// 文字搜尋 API
export async function searchImagesByText(query, topK = 10, { signal } = {}) {
  const url = `/api/search/text`;
  const payload = {
    query,
    top_k: topK,
  };
  return request(url, { method: "POST", body: payload, signal });
}

export async function fetchSoundFiles({ signal } = {}) {
  const { data, response } = await request(`/api/sound-files`, { signal, returnResponse: true });
  const list = Array.isArray(data?.files) ? data.files : [];
  const requestUrl = new URL(response.url);
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
  let url = `/api/subtitles`;
  if (clientId) {
    const params = new URLSearchParams({ client: clientId });
    url = `${url}?${params.toString()}`;
  }
  const data = await request(url);
  return {
    subtitle: data?.subtitle ?? null,
  };
}

export async function fetchCaptionState(clientId = null) {
  let url = `/api/captions`;
  if (clientId) {
    const params = new URLSearchParams({ client: clientId });
    url = `${url}?${params.toString()}`;
  }
  const data = await request(url);
  return {
    caption: data?.caption ?? null,
  };
}

function buildTargetQuery(targetClientId) {
  if (!targetClientId) return "";
  const qs = new URLSearchParams({ target_client_id: targetClientId });
  return `?${qs.toString()}`;
}

async function postJson(url, payload, { signal } = {}) {
  return request(url, { method: "POST", body: payload, signal });
}

export async function createEpisode(payload, { resolve = true, signal } = {}) {
  const qs = resolve === false ? "?resolve=false" : "";
  return postJson(`/api/episodes${qs}`, payload, { signal });
}

export async function updateEpisode(episodeId, payload, { resolve = true, signal } = {}) {
  if (!episodeId) throw new Error("episodeId is required");
  const qs = resolve === false ? "?resolve=false" : "";
  return request(`/api/episodes/${encodeURIComponent(episodeId)}${qs}`, {
    method: "PUT",
    body: payload,
    signal,
  });
}

export async function deleteEpisode(episodeId) {
  if (!episodeId) throw new Error("episodeId is required");
  return request(`/api/episodes/${encodeURIComponent(episodeId)}`, { method: "DELETE" });
}

export async function cloneEpisode(episodeId, payload, { resolve = true, signal } = {}) {
  if (!episodeId) throw new Error("episodeId is required");
  if (!payload || typeof payload !== "object") throw new Error("payload is required");
  const qs = resolve === false ? "?resolve=false" : "";
  return postJson(`/api/episodes/${encodeURIComponent(episodeId)}/clone${qs}`, payload, { signal });
}

export async function playEpisode(episodeId, payload = {}, { signal } = {}) {
  if (!episodeId) throw new Error("episodeId is required");
  const body = payload && typeof payload === "object" ? payload : {};
  return postJson(`/api/episodes/${encodeURIComponent(episodeId)}/play`, body, { signal });
}

export async function triggerTts(payload, options = {}) {
  return postJson(`/api/tts`, payload, options);
}

export async function speakWithSubtitle(payload, options = {}) {
  return postJson(`/api/speak-with-subtitle`, payload, options);
}

export async function queueSoundPlay(filename, targetClientId = null, options = {}) {
  const body = { filename };
  if (targetClientId) {
    body.target_client_id = targetClientId;
  }
  return postJson(`/api/sound-play`, body, options);
}

export async function setSubtitle(payload, targetClientId = null, options = {}) {
  const url = `/api/subtitles${buildTargetQuery(targetClientId)}`;
  return postJson(url, payload, options);
}

export async function clearSubtitle(targetClientId = null, { signal } = {}) {
  const url = `/api/subtitles${buildTargetQuery(targetClientId)}`;
  await request(url, { method: "DELETE", signal });
  return true;
}

export async function setCaption(payload, targetClientId = null, options = {}) {
  const url = `/api/captions${buildTargetQuery(targetClientId)}`;
  return postJson(url, payload, options);
}

export async function clearCaption(targetClientId = null, { signal } = {}) {
  const url = `/api/captions${buildTargetQuery(targetClientId)}`;
  await request(url, { method: "DELETE", signal });
  return true;
}

export async function unlockAudio(targetClientId = null, { signal } = {}) {
  const url = `/api/unlock-audio${buildTargetQuery(targetClientId)}`;
  return request(url, { method: "POST", signal });
}

export async function sendRemoteClick(payload, options = {}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("remote click payload is required");
  }
  return postJson(`/api/remote-click`, payload, options);
}

export async function sendVideoControl(payload, options = {}) {
  if (!payload || typeof payload !== "object") {
    throw new Error("video control payload is required");
  }
  return postJson(`/api/video-control`, payload, options);
}

export async function generateCollageVersion(files, params) {
  const url = `/api/generate-collage-version`;
  const formData = new FormData();
  
  // Add files
  for (const file of files) {
    formData.append("files", file);
  }
  
  // Add params as JSON string
  formData.append("params", JSON.stringify(params));
  
  const result = await request(url, { method: "POST", body: formData });
  
  // Build image URL
  const imageUrl = buildImageUrl(result.output_image, `${API_BASE}/generated_images/`);
  
  return {
    ...result,
    imageUrl,
  };
}

export async function listOffspringImages({ signal } = {}) {
  const url = `/api/offspring-images`;
  return request(url, { signal });
}

export async function generateCollageVersionFromNames(imageNames, params) {
  const url = `/api/generate-collage-version`;
  return request(url, {
    method: "POST",
    body: {
      image_names: imageNames,
      ...params,
    },
  });
}

export async function getCollageProgress(taskId) {
  const url = `/api/collage-version/${taskId}/progress`;
  return request(url);
}

export async function generateMixTwo(params) {
  const url = `/api/generate/mix-two`;
  const result = await request(url, { method: "POST", body: params });
  
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

export async function createIframeTimeline(payload, { resolve = true, signal } = {}) {
  const qs = resolve === false ? "?resolve=false" : "";
  return postJson(`/api/iframe-timelines${qs}`, payload, { signal });
}

export async function updateIframeTimeline(timelineId, payload, { resolve = true, signal } = {}) {
  const qs = resolve === false ? "?resolve=false" : "";
  return request(`/api/iframe-timelines/${encodeURIComponent(timelineId)}${qs}`, {
    method: "PUT",
    body: payload,
    signal,
  });
}

export async function deleteIframeTimeline(timelineId, { signal } = {}) {
  return request(`/api/iframe-timelines/${encodeURIComponent(timelineId)}`, { method: "DELETE", signal });
}

export async function cloneIframeTimeline(timelineId, payload, { resolve = true, signal } = {}) {
  const qs = resolve === false ? "?resolve=false" : "";
  return postJson(
    `/api/iframe-timelines/${encodeURIComponent(timelineId)}/clone${qs}`,
    payload,
    { signal },
  );
}

export async function playIframeTimeline(timelineId, payload = {}, { targetClientId = null, signal } = {}) {
  if (!timelineId) {
    throw new Error("timelineId is required");
  }
  const params = new URLSearchParams();
  if (targetClientId) {
    params.set("target_client_id", targetClientId);
  }
  const qs = params.toString();
  const url = `/api/iframe-timelines/${encodeURIComponent(timelineId)}/play${qs ? `?${qs}` : ""}`;
  return request(url, { method: "POST", body: payload || {}, signal });
}

export async function listIframeSnapshots(clientId = null, { signal } = {}) {
  let url = `/api/iframe-config/snapshots`;
  if (clientId) {
    const qs = new URLSearchParams({ client: clientId });
    url = `${url}?${qs.toString()}`;
  }
  return request(url, { signal });
}

export async function getIframeSnapshot(clientId, name, { signal } = {}) {
  const url = `/api/iframe-config/snapshots/${encodeURIComponent(clientId)}/${encodeURIComponent(name)}`;
  return request(url, { signal });
}

export async function saveIframeSnapshot(clientId, name, payload, { signal } = {}) {
  const url = `/api/iframe-config/snapshots/${encodeURIComponent(clientId)}/${encodeURIComponent(name)}`;
  return request(url, { method: "PUT", body: payload, signal });
}

export async function deleteIframeSnapshot(clientId, name, { signal } = {}) {
  const url = `/api/iframe-config/snapshots/${encodeURIComponent(clientId)}/${encodeURIComponent(name)}`;
  return request(url, { method: "DELETE", signal });
}

export async function cloneIframeSnapshot(clientId, name, payload, { signal } = {}) {
  const url = `/api/iframe-config/snapshots/${encodeURIComponent(clientId)}/${encodeURIComponent(name)}/clone`;
  return postJson(url, payload, { signal });
}

export async function restoreIframeSnapshot(clientId, snapshotName, { signal } = {}) {
  if (!snapshotName) {
    throw new Error("snapshotName is required");
  }
  const body = { snapshot_name: snapshotName };
  if (clientId) {
    body.client_id = clientId;
  }
  return request(`/api/iframe-config/restore`, { method: "POST", body, signal });
}

async function uploadImageForSearch(file, { signal } = {}) {
  if (!file) {
    throw new Error("請先選擇圖片");
  }

  const url = `/api/screenshots`;
  const formData = new FormData();
  formData.append("file", file);

  const data = await request(url, { method: "POST", body: formData, signal });
  const uploadedPath = data.absolute_path || data.relative_path;

  if (!uploadedPath) {
    throw new Error("上傳成功但無法取得檔案路徑");
  }

  const searchPath = data.original_filename
    ? `backend/offspring_images/${data.original_filename}`
    : uploadedPath;

  return {
    searchPath,
    fallbackPath: uploadedPath,
  };
}

export function createImageUploadRequest(file) {
  const controller = new AbortController();
  const promise = uploadImageForSearch(file, { signal: controller.signal });
  return { controller, promise };
}

export function createImageSearchRequest(imagePath, topK = 10) {
  const controller = new AbortController();
  const promise = searchImagesByImage(imagePath, topK, { signal: controller.signal });
  return { controller, promise };
}

export function createTextSearchRequest(query, topK = 10) {
  const controller = new AbortController();
  const promise = searchImagesByText(query, topK, { signal: controller.signal });
  return { controller, promise };
}
