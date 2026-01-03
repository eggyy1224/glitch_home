import { apiClient } from "./client";
import type { RequestOptions, RequestWithResponse } from "../utils/request";

export interface SoundFileEntry {
  name?: string;
  url?: string;
  [key: string]: unknown;
}

const MAX_DECODE_PASSES = 3;
const PERCENT_SEQUENCE = /%[0-9A-Fa-f]{2}/;

function normalizeEncodedPath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => {
      if (!segment) return segment;
      let decoded = segment;
      for (let i = 0; i < MAX_DECODE_PASSES; i += 1) {
        if (!PERCENT_SEQUENCE.test(decoded)) break;
        try {
          const next = decodeURIComponent(decoded);
          if (next === decoded) break;
          decoded = next;
        } catch (err) {
          break;
        }
      }
      return encodeURIComponent(decoded);
    })
    .join("/");
}

function buildTargetQuery(targetClientId: string | null | undefined): Record<string, string> | undefined {
  if (!targetClientId) return undefined;
  return { target_client_id: targetClientId };
}

export async function fetchSoundFiles({ signal }: RequestOptions = {}): Promise<{ files: SoundFileEntry[] }> {
  const { data, response } = (await apiClient.request(`/api/sound-files`, {
    signal,
    returnResponse: true,
  })) as RequestWithResponse<{ files?: SoundFileEntry[] }>;

  const list = Array.isArray(data?.files) ? data.files : [];
  const requestUrl = new URL(response.url);
  const mapped = list.map((file) => {
    if (!file?.url) return file;
    try {
      const href = String(file.url);
      const absolute = new URL(href, requestUrl.origin);
      absolute.pathname = normalizeEncodedPath(absolute.pathname);
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
  const data = await apiClient.get<{ subtitle?: string | null }>(`/api/subtitles`, {
    query: clientId ? { client: clientId } : undefined,
  });
  return { subtitle: data.subtitle ?? null };
}

export async function fetchCaptionState(clientId: string | null = null): Promise<{ caption: string | null }> {
  const data = await apiClient.get<{ caption?: string | null }>(`/api/captions`, {
    query: clientId ? { client: clientId } : undefined,
  });
  return { caption: data.caption ?? null };
}

export async function triggerTts(payload: unknown, options: RequestOptions = {}): Promise<unknown> {
  return apiClient.post(`/api/tts`, payload, options);
}

export async function speakWithSubtitle(payload: unknown, options: RequestOptions = {}): Promise<unknown> {
  return apiClient.post(`/api/speak-with-subtitle`, payload, options);
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
  return apiClient.post(`/api/sound-play`, body, options);
}

export async function setSubtitle(
  payload: Record<string, unknown>,
  targetClientId: string | null = null,
  options: RequestOptions = {},
): Promise<unknown> {
  return apiClient.post(`/api/subtitles`, payload, {
    ...options,
    query: buildTargetQuery(targetClientId),
  });
}

export async function clearSubtitle(targetClientId: string | null = null, { signal }: RequestOptions = {}): Promise<boolean> {
  await apiClient.del(`/api/subtitles`, {
    signal,
    query: buildTargetQuery(targetClientId),
  });
  return true;
}

export async function setCaption(
  payload: Record<string, unknown>,
  targetClientId: string | null = null,
  options: RequestOptions = {},
): Promise<unknown> {
  return apiClient.post(`/api/captions`, payload, {
    ...options,
    query: buildTargetQuery(targetClientId),
  });
}

export async function clearCaption(targetClientId: string | null = null, { signal }: RequestOptions = {}): Promise<boolean> {
  await apiClient.del(`/api/captions`, {
    signal,
    query: buildTargetQuery(targetClientId),
  });
  return true;
}

export async function unlockAudio(targetClientId: string | null = null, { signal }: RequestOptions = {}): Promise<unknown> {
  return apiClient.post(`/api/unlock-audio`, undefined, {
    signal,
    query: buildTargetQuery(targetClientId),
  });
}

export interface BgmTrackEntry {
  filename: string;
  url: string;
}

export interface VideoAssetEntry {
  filename: string;
  url: string;
}

export async function fetchBgmAssets({ signal }: RequestOptions = {}): Promise<{ tracks: BgmTrackEntry[] }> {
  const { data, response } = (await apiClient.request(`/api/bgm-assets`, {
    signal,
    returnResponse: true,
  })) as RequestWithResponse<{ tracks?: BgmTrackEntry[] }>;

  const list = Array.isArray(data?.tracks) ? data.tracks : [];
  const requestUrl = new URL(response.url);
  const mapped = list.map((track) => {
    if (!track?.url) return track;
    try {
      const href = String(track.url);
      const absolute = new URL(href, requestUrl.origin);
      absolute.pathname = normalizeEncodedPath(absolute.pathname);
      return {
        ...track,
        url: absolute.toString(),
      };
    } catch (err) {
      return track;
    }
  });
  return { tracks: mapped as BgmTrackEntry[] };
}

export async function fetchVideoAssets({ signal }: RequestOptions = {}): Promise<{ videos: VideoAssetEntry[] }> {
  const { data, response } = (await apiClient.request(`/api/video-assets`, {
    signal,
    returnResponse: true,
  })) as RequestWithResponse<{ videos?: VideoAssetEntry[] }>;

  const list = Array.isArray(data?.videos) ? data.videos : [];
  const requestUrl = new URL(response.url);
  const mapped = list.map((video) => {
    if (!video?.url) return video;
    try {
      const href = String(video.url);
      const absolute = new URL(href, requestUrl.origin);
      absolute.pathname = normalizeEncodedPath(absolute.pathname);
      return {
        ...video,
        url: absolute.toString(),
      };
    } catch (err) {
      return video;
    }
  });
  return { videos: mapped as VideoAssetEntry[] };
}
