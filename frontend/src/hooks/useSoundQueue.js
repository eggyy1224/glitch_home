import { useCallback, useState } from "react";

export function useSoundQueue() {
  const [soundPlayRequest, setSoundPlayRequest] = useState(null);

  const handleSoundPlayMessage = useCallback((payload) => {
    if (!payload?.filename) return;
    setSoundPlayRequest({ filename: payload.filename, url: payload.url });
  }, []);

  const handleSoundHandled = useCallback(() => {
    setSoundPlayRequest(null);
  }, []);

  return {
    soundPlayRequest,
    handleSoundPlayMessage,
    handleSoundHandled,
  };
}
