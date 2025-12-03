import { useCallback, useState } from "react";
import { listEpisodes, listIframeTimelines } from "../api";
import type { EpisodeEntry, IframeTimeline } from "../types/timeline";
import type { EditorMode } from "../utils/adminEditorUtils";

interface UseTimelineEpisodeListsParams {
  setMessageForMode: (value: string, targetMode?: EditorMode) => void;
}

export default function useTimelineEpisodeLists({ setMessageForMode }: UseTimelineEpisodeListsParams) {
  const [timelineList, setTimelineList] = useState<IframeTimeline[]>([]);
  const [episodeList, setEpisodeList] = useState<EpisodeEntry[]>([]);
  const [timelineFilter, setTimelineFilter] = useState("");
  const [episodeFilter, setEpisodeFilter] = useState("");

  const refreshTimelines = useCallback(async () => {
    try {
      const data = await listIframeTimelines(timelineFilter || null);
      const list = Array.isArray(data.timelines) ? data.timelines : [];
      setTimelineList(list as IframeTimeline[]);
      setMessageForMode(`已載入 ${data.timelines?.length ?? 0} 筆 timeline`, "timeline");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "載入 timeline 失敗";
      setMessageForMode(errMessage, "timeline");
    }
  }, [setMessageForMode, timelineFilter]);

  const refreshEpisodes = useCallback(async () => {
    try {
      const data = await listEpisodes();
      const list = Array.isArray(data.episodes) ? data.episodes : [];
      const filtered = episodeFilter ? list.filter((e) => `${e.id}`.includes(episodeFilter)) : list;
      setEpisodeList(filtered as EpisodeEntry[]);
      setMessageForMode(`已載入 ${filtered.length} 筆 episode`, "episode");
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "載入 episode 失敗";
      setMessageForMode(errMessage, "episode");
    }
  }, [episodeFilter, setMessageForMode]);

  return {
    timelineList,
    episodeList,
    timelineFilter,
    episodeFilter,
    setTimelineFilter,
    setEpisodeFilter,
    refreshTimelines,
    refreshEpisodes,
  };
}
