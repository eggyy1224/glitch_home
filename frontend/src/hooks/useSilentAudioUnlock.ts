import { useEffect, useRef } from "react";
import { SILENT_AUDIO_SRC } from "../constants/silentAudio";

export function useSilentAudioUnlock() {
  const unlockAudioElementRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = document.createElement("audio");
    audio.src = SILENT_AUDIO_SRC;
    audio.preload = "auto";
    audio.loop = false;
    audio.muted = true;
    audio.setAttribute("playsinline", "true");
    audio.style.position = "absolute";
    audio.style.width = "0";
    audio.style.height = "0";
    audio.style.opacity = "0";
    audio.style.pointerEvents = "none";
    document.body?.appendChild(audio);
    unlockAudioElementRef.current = audio;

    return () => {
      audio.remove();
      if (unlockAudioElementRef.current === audio) {
        unlockAudioElementRef.current = null;
      }
    };
  }, []);

  return unlockAudioElementRef;
}
