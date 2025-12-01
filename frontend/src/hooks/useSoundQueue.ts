import { useCallback, useState } from "react";

export interface SoundPlayRequest {
  filename: string;
  url?: string | undefined;
}

export function useSoundQueue(): {
  soundPlayRequest: SoundPlayRequest | null;
  handleSoundPlayMessage: (payload: unknown) => void;
  handleSoundHandled: () => void;
} {
  const [soundPlayRequest, setSoundPlayRequest] = useState<SoundPlayRequest | null>(null);

  const handleSoundPlayMessage = useCallback((payload: unknown): void => {
    const filename = (payload as { filename?: unknown })?.filename;
    if (typeof filename !== "string" || !filename) return;
    const urlValue = (payload as { url?: unknown })?.url;
    const url = typeof urlValue === "string" ? urlValue : undefined;
    setSoundPlayRequest({ filename, url });
  }, []);

  const handleSoundHandled = useCallback((): void => {
    setSoundPlayRequest(null);
  }, []);

  return {
    soundPlayRequest,
    handleSoundPlayMessage,
    handleSoundHandled,
  };
}
