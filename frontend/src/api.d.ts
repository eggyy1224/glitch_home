import type { ClientQueueItem, ClientState, EpisodeEntry, IframeTimeline, SnapshotEntry } from "./types/admin";

declare module "./api.js" {
  export function listIframeSnapshots(clientId?: string | null, options?: { signal?: AbortSignal }): Promise<{ snapshots?: SnapshotEntry[] }>;
  export function getIframeSnapshot(clientId: string | null, name: string, options?: { signal?: AbortSignal }): Promise<any>;
  export function saveIframeSnapshot(clientId: string | null, name: string, payload: unknown, options?: { signal?: AbortSignal }): Promise<any>;
  export function deleteIframeSnapshot(clientId: string | null, name: string, options?: { signal?: AbortSignal }): Promise<any>;
  export function cloneIframeSnapshot(clientId: string | null, name: string, payload: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<any>;
  export function restoreIframeSnapshot(clientId: string | null, snapshotName: string, options?: { signal?: AbortSignal }): Promise<any>;

  export function fetchIframeTimeline(timelineId: string, options?: { signal?: AbortSignal; resolve?: boolean }): Promise<IframeTimeline>;
  export function listIframeTimelines(clientId?: string | null, options?: { signal?: AbortSignal }): Promise<{ timelines?: IframeTimeline[] }>;
  export function createIframeTimeline(payload: Partial<IframeTimeline>, options?: { resolve?: boolean; signal?: AbortSignal }): Promise<IframeTimeline>;
  export function updateIframeTimeline(
    timelineId: string,
    payload: Partial<IframeTimeline>,
    options?: { resolve?: boolean; signal?: AbortSignal },
  ): Promise<IframeTimeline>;
  export function deleteIframeTimeline(timelineId: string, options?: { signal?: AbortSignal }): Promise<any>;
  export function cloneIframeTimeline(
    timelineId: string,
    payload: Record<string, unknown>,
    options?: { resolve?: boolean; signal?: AbortSignal },
  ): Promise<IframeTimeline>;
  export function playIframeTimeline(
    timelineId: string,
    payload?: Record<string, unknown>,
    options?: { targetClientId?: string | null; signal?: AbortSignal },
  ): Promise<any>;
  export function stopIframeTimeline(targetClientId?: string | null, timelineId?: string | null, options?: { commandId?: string; releaseControl?: boolean }): Promise<any>;

  export function fetchEpisode(episodeId: string, options?: { signal?: AbortSignal; resolve?: boolean }): Promise<EpisodeEntry>;
  export function listEpisodes(options?: { signal?: AbortSignal }): Promise<{ episodes?: EpisodeEntry[] }>;
  export function createEpisode(payload: Partial<EpisodeEntry>, options?: { resolve?: boolean; signal?: AbortSignal }): Promise<EpisodeEntry>;
  export function updateEpisode(
    episodeId: string,
    payload: Partial<EpisodeEntry>,
    options?: { resolve?: boolean; signal?: AbortSignal },
  ): Promise<EpisodeEntry>;
  export function deleteEpisode(episodeId: string): Promise<any>;
  export function cloneEpisode(
    episodeId: string,
    payload: Record<string, unknown>,
    options?: { resolve?: boolean; signal?: AbortSignal },
  ): Promise<EpisodeEntry>;
  export function playEpisode(episodeId: string, payload?: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<any>;

  export function fetchClientStates(options?: { signal?: AbortSignal }): Promise<ClientState[]>;
  export function fetchClientQueue(
    clientId: string,
    options?: { status?: string | null; page?: number; limit?: number; signal?: AbortSignal },
  ): Promise<{ items?: ClientQueueItem[]; total?: number }>;
  export function enqueueClientQueueItem(payload: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<any>;
  export function cancelClientQueueItems(ids: string[] | string, options?: { signal?: AbortSignal }): Promise<any>;
  export function delayClientQueueItems(
    ids: string[] | string,
    options?: { deltaSeconds?: number | null; eta?: string | number | null; signal?: AbortSignal },
  ): Promise<any>;
  export function moveClientQueueItems(
    ids: string[] | string,
    options?: { priority?: number | null; position?: string | number | null; signal?: AbortSignal },
  ): Promise<any>;
}
