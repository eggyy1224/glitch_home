import { API_BASE, IMAGES_BASE, buildImageUrl, request } from "./utils/request";
import type { RequestOptions } from "./utils/request";
import type { ClientQueueItem, ClientState, EpisodeEntry, IframeTimeline, SnapshotEntry } from "./types/admin";
import type { Scene, Script } from "./types/scene";
import type {
  GenerateMixTwoParams,
  GenerateMixTwoResponse,
  ListOffspringImagesResponse,
  SearchRequestResult,
} from "./types/generate";

interface ResolveOption extends RequestOptions {
  resolve?: boolean;
  version?: number;
}

function withSignal(signal?: AbortSignal | null): Partial<RequestOptions> {
  return signal ? { signal } : {};
}

export interface CameraPreset {
  name: string;
  position: unknown;
  target: unknown;
  [key: string]: unknown;
}

export interface CollageConfigPayload {
  images?: string[];
  image_count?: number;
  rows?: number;
  cols?: number;
  mix?: boolean;
  stage_width?: number;
  stage_height?: number;
  seed?: number | null;
  [key: string]: unknown;
}

export interface SoundFileEntry {
  name?: string;
  url?: string;
  [key: string]: unknown;
}

export async function fetchKinship(img: string, depth = -1, { signal }: RequestOptions = {}): Promise<unknown> {
  const url = `/api/kinship?img=${encodeURIComponent(img)}&depth=${encodeURIComponent(depth)}`;
  return request(url, withSignal(signal));
}

export async function fetchCameraPresets({ signal }: RequestOptions = {}): Promise<CameraPreset[]> {
  const url = `/api/camera-presets`;
  return request(url, withSignal(signal));
}

export async function saveCameraPreset(preset: Partial<CameraPreset>): Promise<CameraPreset> {
  const url = `/api/camera-presets`;
  return request(url, { method: "POST", body: preset });
}

export async function deleteCameraPreset(name: string): Promise<boolean> {
  const url = `/api/camera-presets/${encodeURIComponent(name)}`;
  await request(url, { method: "DELETE" });
  return true;
}

export async function fetchCollageConfig(clientId: string | null = null, { signal }: RequestOptions = {}): Promise<unknown> {
  let url = `/api/collage-config`;
  if (clientId) {
    const params = new URLSearchParams({ client: clientId });
    url = `${url}?${params.toString()}`;
  }
  return request(url, withSignal(signal));
}

export async function fetchIframeTimeline(
  timelineId: string,
  { signal, resolve = true }: ResolveOption = {},
): Promise<IframeTimeline> {
  if (!timelineId) {
    throw new Error("timelineId is required");
  }
  const params = resolve === false ? "?resolve=false" : "";
  const url = `/api/iframe-timelines/${encodeURIComponent(timelineId)}${params}`;
  return request(url, withSignal(signal));
}

export async function listIframeTimelines(
  clientId: string | null = null,
  { signal }: RequestOptions = {},
): Promise<{ timelines?: IframeTimeline[] }> {
  let url = `/api/iframe-timelines`;
  if (clientId) {
    const qs = new URLSearchParams({ client: clientId });
    url = `${url}?${qs.toString()}`;
  }
  return request(url, withSignal(signal));
}

export async function fetchEpisode(
  episodeId: string,
  { signal, resolve = true }: ResolveOption = {},
): Promise<EpisodeEntry> {
  if (!episodeId) {
    throw new Error("episodeId is required");
  }
  const params = resolve === false ? "?resolve=false" : "";
  const url = `/api/episodes/${encodeURIComponent(episodeId)}${params}`;
  return request(url, withSignal(signal));
}

export async function listEpisodes({ signal }: RequestOptions = {}): Promise<{ episodes?: EpisodeEntry[] }> {
  const url = `/api/episodes`;
  return request(url, withSignal(signal));
}

export async function fetchScene(sceneId: string, { signal, resolve = true, version }: ResolveOption = {}): Promise<Scene> {
  if (!sceneId) throw new Error("sceneId is required");
  const qs = new URLSearchParams();
  if (resolve === false) qs.set("resolve", "false");
  if (typeof version === "number") qs.set("version", `${version}`);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scenes/${encodeURIComponent(sceneId)}${suffix}`, withSignal(signal));
}

export async function listScenes({ signal }: RequestOptions = {}): Promise<{ scenes?: Scene[] }> {
  return request(`/api/scenes`, withSignal(signal));
}

export async function createScene(payload: Partial<Scene>, { resolve = true, signal }: ResolveOption = {}): Promise<Scene> {
  const qs = new URLSearchParams();
  if (resolve === false) qs.set("resolve", "false");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scenes${suffix}`, { method: "POST", body: payload, ...withSignal(signal) });
}

export async function updateScene(
  sceneId: string,
  payload: Partial<Scene>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<Scene> {
  if (!sceneId) throw new Error("sceneId is required");
  const qs = new URLSearchParams();
  if (resolve === false) qs.set("resolve", "false");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scenes/${encodeURIComponent(sceneId)}${suffix}`, {
    method: "PUT",
    body: payload,
    ...withSignal(signal),
  });
}

export async function deleteScene(sceneId: string): Promise<unknown> {
  if (!sceneId) throw new Error("sceneId is required");
  return request(`/api/scenes/${encodeURIComponent(sceneId)}`, { method: "DELETE" });
}

export async function cloneScene(
  sceneId: string,
  payload: Record<string, unknown>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<Scene> {
  if (!sceneId) throw new Error("sceneId is required");
  const qs = new URLSearchParams();
  if (resolve === false) qs.set("resolve", "false");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scenes/${encodeURIComponent(sceneId)}/clone${suffix}`, {
    method: "POST",
    body: payload,
    ...withSignal(signal),
  });
}

export async function playScene(
  sceneId: string,
  payload: Record<string, unknown> | null = null,
  { signal, allowDraft = false, version }: RequestOptions & { allowDraft?: boolean; version?: number } = {},
): Promise<unknown> {
  if (!sceneId) throw new Error("sceneId is required");
  const body = payload && typeof payload === "object" ? payload : {};
  const qs = new URLSearchParams();
  if (allowDraft) qs.set("allow_draft", "true");
  if (typeof version === "number") qs.set("version", `${version}`);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scenes/${encodeURIComponent(sceneId)}/play${suffix}`, { method: "POST", body, ...withSignal(signal) });
}

export async function listSceneVersions(sceneId: string, { signal }: RequestOptions = {}): Promise<{ versions?: unknown[] }> {
  if (!sceneId) throw new Error("sceneId is required");
  return request(`/api/scenes/${encodeURIComponent(sceneId)}/versions`, withSignal(signal));
}

export async function publishScene(
  sceneId: string,
  payload: Record<string, unknown> | null = null,
  { signal, expectedVersion }: RequestOptions & { expectedVersion?: number } = {},
): Promise<Scene> {
  if (!sceneId) throw new Error("sceneId is required");
  const qs = new URLSearchParams();
  if (typeof expectedVersion === "number") qs.set("expected_version", `${expectedVersion}`);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scenes/${encodeURIComponent(sceneId)}/publish${suffix}`, {
    method: "POST",
    body: payload || {},
    ...withSignal(signal),
  });
}

export async function rollbackScene(
  sceneId: string,
  payload: Record<string, unknown>,
  { signal, expectedVersion }: RequestOptions & { expectedVersion?: number } = {},
): Promise<Scene> {
  if (!sceneId) throw new Error("sceneId is required");
  if (!payload || typeof payload.version === "undefined") {
    throw new Error("rollback payload requires version");
  }
  const qs = new URLSearchParams();
  if (typeof expectedVersion === "number") qs.set("expected_version", `${expectedVersion}`);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scenes/${encodeURIComponent(sceneId)}/rollback${suffix}`, {
    method: "POST",
    body: payload,
    ...withSignal(signal),
  });
}

export async function fetchScript(scriptId: string, { signal, resolve = true, version }: ResolveOption = {}): Promise<Script> {
  if (!scriptId) throw new Error("scriptId is required");
  const qs = new URLSearchParams();
  if (resolve === false) qs.set("resolve", "false");
  if (typeof version === "number") qs.set("version", `${version}`);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scripts/${encodeURIComponent(scriptId)}${suffix}`, withSignal(signal));
}

export async function listScripts({ signal }: RequestOptions = {}): Promise<{ scripts?: Script[] }> {
  return request(`/api/scripts`, withSignal(signal));
}

export async function createScript(
  payload: Partial<Script>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<Script> {
  const qs = new URLSearchParams();
  if (resolve === false) qs.set("resolve", "false");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scripts${suffix}`, { method: "POST", body: payload, ...withSignal(signal) });
}

export async function updateScript(
  scriptId: string,
  payload: Partial<Script>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<Script> {
  if (!scriptId) throw new Error("scriptId is required");
  const qs = new URLSearchParams();
  if (resolve === false) qs.set("resolve", "false");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scripts/${encodeURIComponent(scriptId)}${suffix}`, {
    method: "PUT",
    body: payload,
    ...withSignal(signal),
  });
}

export async function deleteScript(scriptId: string): Promise<unknown> {
  if (!scriptId) throw new Error("scriptId is required");
  return request(`/api/scripts/${encodeURIComponent(scriptId)}`, { method: "DELETE" });
}

export async function cloneScript(
  scriptId: string,
  payload: Record<string, unknown>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<Script> {
  if (!scriptId) throw new Error("scriptId is required");
  const qs = new URLSearchParams();
  if (resolve === false) qs.set("resolve", "false");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scripts/${encodeURIComponent(scriptId)}/clone${suffix}`, {
    method: "POST",
    body: payload,
    ...withSignal(signal),
  });
}

export async function playScript(
  scriptId: string,
  payload: Record<string, unknown> | null = null,
  { signal, allowDraft = false, version }: RequestOptions & { allowDraft?: boolean; version?: number } = {},
): Promise<unknown> {
  if (!scriptId) throw new Error("scriptId is required");
  const body = payload && typeof payload === "object" ? payload : {};
  const qs = new URLSearchParams();
  if (allowDraft) qs.set("allow_draft", "true");
  if (typeof version === "number") qs.set("version", `${version}`);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scripts/${encodeURIComponent(scriptId)}/play${suffix}`, {
    method: "POST",
    body,
    ...withSignal(signal),
  });
}

export async function listScriptVersions(scriptId: string, { signal }: RequestOptions = {}): Promise<{ versions?: unknown[] }> {
  if (!scriptId) throw new Error("scriptId is required");
  return request(`/api/scripts/${encodeURIComponent(scriptId)}/versions`, withSignal(signal));
}

export async function publishScript(
  scriptId: string,
  payload: Record<string, unknown> | null = null,
  { signal, expectedVersion }: RequestOptions & { expectedVersion?: number } = {},
): Promise<Script> {
  if (!scriptId) throw new Error("scriptId is required");
  const qs = new URLSearchParams();
  if (typeof expectedVersion === "number") qs.set("expected_version", `${expectedVersion}`);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scripts/${encodeURIComponent(scriptId)}/publish${suffix}`, {
    method: "POST",
    body: payload || {},
    ...withSignal(signal),
  });
}

export async function rollbackScript(
  scriptId: string,
  payload: Record<string, unknown>,
  { signal, expectedVersion }: RequestOptions & { expectedVersion?: number } = {},
): Promise<Script> {
  if (!scriptId) throw new Error("scriptId is required");
  if (!payload || typeof payload.version === "undefined") {
    throw new Error("rollback payload requires version");
  }
  const qs = new URLSearchParams();
  if (typeof expectedVersion === "number") qs.set("expected_version", `${expectedVersion}`);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/api/scripts/${encodeURIComponent(scriptId)}/rollback${suffix}`, {
    method: "POST",
    body: payload,
    ...withSignal(signal),
  });
}

export async function stopScript(scriptId: string, { signal }: RequestOptions = {}): Promise<unknown> {
  if (!scriptId) throw new Error("scriptId is required");
  return request(`/api/scripts/${encodeURIComponent(scriptId)}/stop`, { method: "POST", ...withSignal(signal) });
}

export async function saveCollageConfig(config: CollageConfigPayload): Promise<unknown> {
  const url = `/api/collage-config`;
  return request(url, { method: "PUT", body: config });
}

export async function uploadScreenshot(
  blob: Blob,
  requestId: string | null = null,
  clientId: string | null = null,
): Promise<unknown> {
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

export async function reportScreenshotFailure(requestId: string, errorMessage = "", clientId: string | null = null) {
  const url = `/api/screenshots/${encodeURIComponent(requestId)}/fail`;
  const payload: Record<string, unknown> = { error: errorMessage };
  if (clientId) {
    payload.client_id = clientId;
  }
  return request(url, { method: "POST", body: payload });
}

// 以圖搜圖 API
export async function searchImagesByImage(
  imagePath: string,
  topK = 10,
  { signal }: RequestOptions = {},
): Promise<SearchRequestResult> {
  const url = `/api/search/image`;
  const payload = {
    image_path: imagePath,
    top_k: topK,
  };
  return request(url, { method: "POST", body: payload, ...withSignal(signal) });
}

// 文字搜尋 API
export async function searchImagesByText(
  query: string,
  topK = 10,
  { signal }: RequestOptions = {},
): Promise<SearchRequestResult> {
  const url = `/api/search/text`;
  const payload = {
    query,
    top_k: topK,
  };
  return request(url, { method: "POST", body: payload, ...withSignal(signal) });
}

export async function fetchSoundFiles({ signal }: RequestOptions = {}): Promise<{ files: SoundFileEntry[] }> {
  const { data, response } = (await request(`/api/sound-files`, {
    ...withSignal(signal),
    returnResponse: true,
  })) as { data: { files?: SoundFileEntry[] }; response: Response };
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
  return { files: mapped as SoundFileEntry[] };
}

export async function fetchSubtitleState(clientId: string | null = null): Promise<{ subtitle: string | null }> {
  let url = `/api/subtitles`;
  if (clientId) {
    const params = new URLSearchParams({ client: clientId });
    url = `${url}?${params.toString()}`;
  }
  const data = await request<{ subtitle?: string | null }>(url);
  return {
    subtitle: data.subtitle ?? null,
  };
}

export async function fetchCaptionState(clientId: string | null = null): Promise<{ caption: string | null }> {
  let url = `/api/captions`;
  if (clientId) {
    const params = new URLSearchParams({ client: clientId });
    url = `${url}?${params.toString()}`;
  }
  const data = await request<{ caption?: string | null }>(url);
  return {
    caption: data.caption ?? null,
  };
}

function buildTargetQuery(targetClientId: string | null | undefined): string {
  if (!targetClientId) return "";
  const qs = new URLSearchParams({ target_client_id: targetClientId });
  return `?${qs.toString()}`;
}

async function postJson<T = unknown>(url: string, payload: unknown, { signal }: RequestOptions = {}): Promise<T> {
  const options: RequestOptions = { method: "POST", body: payload, ...withSignal(signal) };
  return request<T>(url, options);
}

export async function createEpisode(
  payload: Partial<EpisodeEntry>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<EpisodeEntry> {
  const qs = resolve === false ? "?resolve=false" : "";
  return postJson<EpisodeEntry>(`/api/episodes${qs}`, payload, { signal });
}

export async function updateEpisode(
  episodeId: string,
  payload: Partial<EpisodeEntry>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<EpisodeEntry> {
  if (!episodeId) throw new Error("episodeId is required");
  const qs = resolve === false ? "?resolve=false" : "";
  return request<EpisodeEntry>(`/api/episodes/${encodeURIComponent(episodeId)}${qs}`, {
    method: "PUT",
    body: payload,
    ...withSignal(signal),
  });
}

export async function deleteEpisode(episodeId: string): Promise<unknown> {
  if (!episodeId) throw new Error("episodeId is required");
  return request(`/api/episodes/${encodeURIComponent(episodeId)}`, { method: "DELETE" });
}

export async function cloneEpisode(
  episodeId: string,
  payload: Record<string, unknown>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<EpisodeEntry> {
  if (!episodeId) throw new Error("episodeId is required");
  if (!payload || typeof payload !== "object") throw new Error("payload is required");
  const qs = resolve === false ? "?resolve=false" : "";
  return postJson<EpisodeEntry>(`/api/episodes/${encodeURIComponent(episodeId)}/clone${qs}`, payload, { signal });
}

export async function playEpisode(
  episodeId: string,
  payload: Record<string, unknown> = {},
  { signal }: RequestOptions = {},
): Promise<unknown> {
  if (!episodeId) throw new Error("episodeId is required");
  const body = payload && typeof payload === "object" ? payload : {};
  return postJson(`/api/episodes/${encodeURIComponent(episodeId)}/play`, body, { signal });
}

export async function triggerTts(payload: unknown, options: RequestOptions = {}): Promise<unknown> {
  return postJson(`/api/tts`, payload, options);
}

export async function speakWithSubtitle(payload: unknown, options: RequestOptions = {}): Promise<unknown> {
  return postJson(`/api/speak-with-subtitle`, payload, options);
}

export async function queueSoundPlay(
  filename: string,
  targetClientId: string | null = null,
  options: RequestOptions = {},
): Promise<unknown> {
  const body: Record<string, unknown> = { filename };
  if (targetClientId) {
    body.target_client_id = targetClientId;
  }
  return postJson(`/api/sound-play`, body, options);
}

export async function setSubtitle(
  payload: Record<string, unknown>,
  targetClientId: string | null = null,
  options: RequestOptions = {},
): Promise<unknown> {
  const url = `/api/subtitles${buildTargetQuery(targetClientId)}`;
  return postJson(url, payload, options);
}

export async function clearSubtitle(targetClientId: string | null = null, { signal }: RequestOptions = {}): Promise<boolean> {
  const url = `/api/subtitles${buildTargetQuery(targetClientId)}`;
  await request(url, { method: "DELETE", ...withSignal(signal) });
  return true;
}

export async function setCaption(
  payload: Record<string, unknown>,
  targetClientId: string | null = null,
  options: RequestOptions = {},
): Promise<unknown> {
  const url = `/api/captions${buildTargetQuery(targetClientId)}`;
  return postJson(url, payload, options);
}

export async function clearCaption(targetClientId: string | null = null, { signal }: RequestOptions = {}): Promise<boolean> {
  const url = `/api/captions${buildTargetQuery(targetClientId)}`;
  await request(url, { method: "DELETE", ...withSignal(signal) });
  return true;
}

export async function unlockAudio(targetClientId: string | null = null, { signal }: RequestOptions = {}): Promise<unknown> {
  const url = `/api/unlock-audio${buildTargetQuery(targetClientId)}`;
  return request(url, { method: "POST", ...withSignal(signal) });
}

export async function sendRemoteClick(payload: Record<string, unknown>, options: RequestOptions = {}): Promise<unknown> {
  if (!payload || typeof payload !== "object") {
    throw new Error("remote click payload is required");
  }
  return postJson(`/api/remote-click`, payload, options);
}

export async function sendVideoControl(payload: Record<string, unknown>, options: RequestOptions = {}): Promise<unknown> {
  if (!payload || typeof payload !== "object") {
    throw new Error("video control payload is required");
  }
  return postJson(`/api/video-control`, payload, options);
}

export async function stopIframeTimeline(
  targetClientId: string | null,
  timelineId: string | null = null,
  options: { commandId?: string; releaseControl?: boolean } = {},
): Promise<unknown> {
  const body: Record<string, unknown> = {
    target_client_id: targetClientId || null,
    timeline_id: timelineId || null,
    command_id: options.commandId,
    release_control: options.releaseControl !== undefined ? options.releaseControl : true,
  };
  return request(`/api/iframe-timelines/stop`, { method: "POST", body });
}

export async function fetchClientStates({ signal }: RequestOptions = {}): Promise<ClientState[]> {
  const data = await request<{ clients?: ClientState[] }>(`/api/clients/state`, withSignal(signal));
  return Array.isArray(data.clients) ? data.clients : [];
}

export async function fetchClientQueue(
  clientId: string,
  { status = null, page = 1, limit = 50, signal }: { status?: string | null; page?: number; limit?: number; signal?: AbortSignal } = {},
): Promise<{ items?: ClientQueueItem[]; total?: number }> {
  if (!clientId) throw new Error("clientId is required");
  const params = new URLSearchParams({ client: clientId, page: String(page ?? 1), limit: String(limit ?? 50) });
  if (status) params.set("status", status);
  return request(`/api/clients/queue?${params.toString()}`, withSignal(signal));
}

export async function enqueueClientQueueItem(
  payload: Record<string, unknown>,
  { signal }: RequestOptions = {},
): Promise<unknown> {
  return request(`/api/clients/queue`, { method: "POST", body: payload, ...withSignal(signal) });
}

function queueActionPath(ids: string[] | string, action: string): string {
  const first = Array.isArray(ids) && ids.length > 0 ? ids[0] : "batch";
  return `/api/clients/queue/${encodeURIComponent(first)}/${action}`;
}

export async function cancelClientQueueItems(ids: string[] | string, { signal }: RequestOptions = {}): Promise<unknown> {
  const url = queueActionPath(ids, "cancel");
  return request(url, { method: "POST", body: { ids }, ...withSignal(signal) });
}

export async function delayClientQueueItems(
  ids: string[] | string,
  { deltaSeconds = null, eta = null, signal }: { deltaSeconds?: number | null; eta?: string | number | null; signal?: AbortSignal } = {},
): Promise<unknown> {
  const url = queueActionPath(ids, "delay");
  const body: Record<string, unknown> = { ids };
  if (deltaSeconds !== null && deltaSeconds !== undefined) body.delta_seconds = deltaSeconds;
  if (eta !== null && eta !== undefined) body.eta = eta;
  return request(url, { method: "POST", body, ...withSignal(signal) });
}

export async function moveClientQueueItems(
  ids: string[] | string,
  { priority = null, position = null, signal }: { priority?: number | null; position?: string | number | null; signal?: AbortSignal } = {},
): Promise<unknown> {
  const url = queueActionPath(ids, "move");
  const body: Record<string, unknown> = { ids };
  if (priority !== null && priority !== undefined) body.priority = priority;
  if (position) body.position = position;
  return request(url, { method: "POST", body, ...withSignal(signal) });
}

interface CollageVersionResponse {
  output_image_path?: string;
  output_image?: string;
  imageUrl?: string | null;
  [key: string]: unknown;
}

export async function generateCollageVersion(files: File[], params: Record<string, unknown>): Promise<CollageVersionResponse> {
  const url = `/api/generate-collage-version`;
  const formData = new FormData();
  
  // Add files
  for (const file of files) {
    formData.append("files", file);
  }
  
  // Add params as JSON string
  formData.append("params", JSON.stringify(params));
  
  const result = (await request<CollageVersionResponse>(url, { method: "POST", body: formData })) || {};
  
  // Build image URL
  const imageUrl = buildImageUrl(result.output_image ?? null, `${API_BASE}/generated_images/`);
  
  return {
    ...result,
    imageUrl,
  };
}

export async function listOffspringImages({ signal }: RequestOptions = {}): Promise<ListOffspringImagesResponse> {
  const url = `/api/offspring-images`;
  return request(url, withSignal(signal));
}

export async function listVideoAssets({ signal }: RequestOptions = {}): Promise<unknown> {
  const url = `/api/video-assets`;
  return request(url, withSignal(signal));
}

export async function generateCollageVersionFromNames(
  imageNames: string[],
  params: Record<string, unknown>,
): Promise<unknown> {
  const url = `/api/generate-collage-version`;
  return request(url, {
    method: "POST",
    body: {
      image_names: imageNames,
      ...params,
    },
  });
}

export async function getCollageProgress(taskId: string): Promise<unknown> {
  const url = `/api/collage-version/${taskId}/progress`;
  return request(url);
}

export async function generateMixTwo(params: GenerateMixTwoParams): Promise<GenerateMixTwoResponse> {
  const url = `/api/generate/mix-two`;
  const result = (await request(url, { method: "POST", body: params })) as GenerateMixTwoResponse;
  
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

export async function createIframeTimeline(
  payload: Partial<IframeTimeline>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<IframeTimeline> {
  const qs = resolve === false ? "?resolve=false" : "";
  return postJson(`/api/iframe-timelines${qs}`, payload, { signal });
}

export async function updateIframeTimeline(
  timelineId: string,
  payload: Partial<IframeTimeline>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<IframeTimeline> {
  const qs = resolve === false ? "?resolve=false" : "";
  return request(`/api/iframe-timelines/${encodeURIComponent(timelineId)}${qs}`, {
    method: "PUT",
    body: payload,
    ...withSignal(signal),
  });
}

export async function deleteIframeTimeline(timelineId: string, { signal }: RequestOptions = {}): Promise<unknown> {
  return request(`/api/iframe-timelines/${encodeURIComponent(timelineId)}`, { method: "DELETE", ...withSignal(signal) });
}

export async function cloneIframeTimeline(
  timelineId: string,
  payload: Record<string, unknown>,
  { resolve = true, signal }: ResolveOption = {},
): Promise<IframeTimeline> {
  const qs = resolve === false ? "?resolve=false" : "";
  return postJson(
    `/api/iframe-timelines/${encodeURIComponent(timelineId)}/clone${qs}`,
    payload,
    { signal },
  );
}

export async function playIframeTimeline(
  timelineId: string,
  payload: Record<string, unknown> = {},
  { targetClientId = null, signal }: { targetClientId?: string | null; signal?: AbortSignal } = {},
): Promise<unknown> {
  if (!timelineId) {
    throw new Error("timelineId is required");
  }
  const params = new URLSearchParams();
  if (targetClientId) {
    params.set("target_client_id", targetClientId);
  }
  const qs = params.toString();
  const url = `/api/iframe-timelines/${encodeURIComponent(timelineId)}/play${qs ? `?${qs}` : ""}`;
  return request(url, { method: "POST", body: payload || {}, ...withSignal(signal) });
}

export async function listIframeSnapshots(
  clientId: string | null = null,
  { signal }: RequestOptions = {},
): Promise<{ snapshots?: SnapshotEntry[] }> {
  let url = `/api/iframe-config/snapshots`;
  if (clientId) {
    const qs = new URLSearchParams({ client: clientId });
    url = `${url}?${qs.toString()}`;
  }
  return request(url, withSignal(signal));
}

export async function getIframeSnapshot(
  clientId: string | null,
  name: string,
  { signal }: RequestOptions = {},
): Promise<unknown> {
  if (!clientId) {
    throw new Error("clientId is required");
  }
  const url = `/api/iframe-config/snapshots/${encodeURIComponent(clientId)}/${encodeURIComponent(name)}`;
  return request(url, withSignal(signal));
}

export async function saveIframeSnapshot(
  clientId: string | null,
  name: string,
  payload: unknown,
  { signal }: RequestOptions = {},
): Promise<unknown> {
  if (!clientId) {
    throw new Error("clientId is required");
  }
  const url = `/api/iframe-config/snapshots/${encodeURIComponent(clientId)}/${encodeURIComponent(name)}`;
  return request(url, { method: "PUT", body: payload, ...withSignal(signal) });
}

export async function deleteIframeSnapshot(
  clientId: string | null,
  name: string,
  { signal }: RequestOptions = {},
): Promise<unknown> {
  if (!clientId) {
    throw new Error("clientId is required");
  }
  const url = `/api/iframe-config/snapshots/${encodeURIComponent(clientId)}/${encodeURIComponent(name)}`;
  return request(url, { method: "DELETE", ...withSignal(signal) });
}

export async function cloneIframeSnapshot(
  clientId: string | null,
  name: string,
  payload: Record<string, unknown>,
  { signal }: RequestOptions = {},
): Promise<unknown> {
  if (!clientId) {
    throw new Error("clientId is required");
  }
  const url = `/api/iframe-config/snapshots/${encodeURIComponent(clientId)}/${encodeURIComponent(name)}/clone`;
  return postJson(url, payload, { signal });
}

export async function restoreIframeSnapshot(
  clientId: string | null,
  snapshotName: string,
  { signal }: RequestOptions = {},
): Promise<unknown> {
  if (!snapshotName) {
    throw new Error("snapshotName is required");
  }
  const body: Record<string, unknown> = { snapshot_name: snapshotName };
  if (clientId) {
    body.client_id = clientId;
  }
  return request(`/api/iframe-config/restore`, { method: "POST", body, ...withSignal(signal) });
}

async function uploadImageForSearch(file: File | Blob, { signal }: RequestOptions = {}): Promise<{
  searchPath: string;
  fallbackPath: string;
}> {
  if (!file) {
    throw new Error("請先選擇圖片");
  }

  const url = `/api/screenshots`;
  const formData = new FormData();
  formData.append("file", file);

  const data = await request<{
    absolute_path?: string;
    relative_path?: string;
    original_filename?: string;
  }>(url, { method: "POST", body: formData, ...withSignal(signal) });
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

export function createImageUploadRequest(file: File | Blob) {
  const controller = new AbortController();
  const promise = uploadImageForSearch(file, { signal: controller.signal });
  return { controller, promise };
}

export function createImageSearchRequest(imagePath: string, topK = 10): {
  controller: AbortController;
  promise: Promise<SearchRequestResult>;
} {
  const controller = new AbortController();
  const promise = searchImagesByImage(imagePath, topK, { signal: controller.signal });
  return { controller, promise };
}

export function createTextSearchRequest(query: string, topK = 10): {
  controller: AbortController;
  promise: Promise<SearchRequestResult>;
} {
  const controller = new AbortController();
  const promise = searchImagesByText(query, topK, { signal: controller.signal });
  return { controller, promise };
}
