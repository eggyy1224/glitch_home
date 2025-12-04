import { useEffect, useState } from "react";

const MOBILE_UA_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

const isMobileUserAgent = () => {
  if (typeof navigator === "undefined" || typeof navigator.userAgent !== "string") return false;
  return MOBILE_UA_REGEX.test(navigator.userAgent);
};

export function useIsMobileAdmin(breakpoint = 900) {
  const getIsMobile = () => {
    if (typeof window === "undefined") return false;
    const widthMatch = window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
    return widthMatch || isMobileUserAgent();
  };

  const [isMobile, setIsMobile] = useState<boolean>(getIsMobile);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => setIsMobile(getIsMobile());
    handler();
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [breakpoint]);

  return isMobile;
}
