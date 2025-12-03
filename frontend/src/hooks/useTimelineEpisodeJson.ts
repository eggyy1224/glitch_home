import { useCallback, useEffect, useMemo, useState } from "react";
import { pretty } from "../adminPanelUtils";
import type { SnapshotConfig } from "../types/admin";
import type { EpisodeEntry, IframeTimeline } from "../types/timeline";
import type { EditorMode, EditorValidationError } from "../utils/adminEditorUtils";
import { validateEpisode, validateSnapshot, validateTimeline } from "../utils/adminEditorUtils";

interface UseTimelineEpisodeJsonParams {
  mode: EditorMode;
  jsonLocked: boolean;
  initialJson: string;
  onDirty: () => void;
  onValidation: (errors: EditorValidationError[]) => void;
  onTimelineParsed: (data: IframeTimeline) => void;
  onEpisodeParsed: (data: EpisodeEntry) => void;
  onSnapshotParsed: (data: SnapshotConfig) => void;
}

export default function useTimelineEpisodeJson({
  mode,
  jsonLocked,
  initialJson,
  onDirty,
  onValidation,
  onEpisodeParsed,
  onSnapshotParsed,
  onTimelineParsed,
}: UseTimelineEpisodeJsonParams) {
  const [jsonText, setJsonText] = useState(initialJson);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);

  const handleJsonChange = useCallback(
    (text: string) => {
      setJsonText(text);
      onDirty();
    },
    [onDirty],
  );

  const syncJsonFromData = useCallback(
    (data: unknown) => {
      if (jsonLocked) return;
      setJsonText(pretty(data));
      setLastSyncAt(new Date());
    },
    [jsonLocked],
  );

  const validator = useMemo(() => {
    if (mode === "timeline") return validateTimeline;
    if (mode === "episode") return validateEpisode;
    return validateSnapshot;
  }, [mode]);

  useEffect(() => {
    if (jsonLocked) return undefined;
    const handle = setTimeout(() => {
      try {
        const parsed = JSON.parse(jsonText);
        if (mode === "timeline") {
          onTimelineParsed(parsed as IframeTimeline);
        } else if (mode === "episode") {
          onEpisodeParsed(parsed as EpisodeEntry);
        } else {
          onSnapshotParsed(parsed as SnapshotConfig);
        }
        onValidation(validator(parsed as never));
        setLastSyncAt(new Date());
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "JSON 解析失敗";
        onValidation([{ path: "json", message: errMessage }]);
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [jsonLocked, jsonText, mode, onEpisodeParsed, onSnapshotParsed, onTimelineParsed, onValidation, validator]);

  return {
    jsonText,
    setJsonText,
    lastSyncAt,
    handleJsonChange,
    syncJsonFromData,
  };
}
