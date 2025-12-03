import { useCallback, useEffect, useState } from "react";
import type { EditorMode } from "../utils/adminEditorUtils";

export default function useTimelineEpisodeMessages(mode: EditorMode) {
  const [message, setMessage] = useState("");
  const [messageByMode, setMessageByMode] = useState<Record<EditorMode, string>>({
    timeline: "",
    episode: "",
    snapshot: "",
  });

  const setMessageForMode = useCallback(
    (value: string, targetMode: EditorMode = mode) => {
      setMessageByMode((prev) => {
        const current = prev[targetMode];
        if (current === value) return prev;
        return { ...prev, [targetMode]: value };
      });
      if (targetMode === mode) {
        setMessage((prev) => (prev === value ? prev : value));
      }
    },
    [mode],
  );

  useEffect(() => {
    const next = messageByMode[mode] || "";
    setMessage((prev) => (prev === next ? prev : next));
  }, [messageByMode, mode]);

  return { message, messageByMode, setMessageForMode };
}
