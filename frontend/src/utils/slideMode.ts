const FONT_FAMILY = "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif";
type StyleMap = Record<string, string | number | undefined>;

export type KinshipRelation = "children" | "parents" | "siblings" | "ancestors";

export const SlideSourceMode = Object.freeze({
  VECTOR: "vector",
  KINSHIP: "kinship",
});

export const DEFAULT_SLIDE_TOP_K = 15;
export const DEFAULT_KINSHIP_DEPTH = -1;
export const DEFAULT_KINSHIP_ORDER: KinshipRelation[] = ["children", "siblings", "parents", "ancestors"];

export const getSlideSourceMode = (params: URLSearchParams | null | undefined) => {
  const mode = (params?.get("slide_source") || SlideSourceMode.VECTOR).toLowerCase();
  return mode === SlideSourceMode.KINSHIP ? SlideSourceMode.KINSHIP : SlideSourceMode.VECTOR;
};

export const getSizeClass = (width?: number | null, height?: number | null): "large" | "medium" | "small" | "xsmall" => {
  if (!width || !height) return "large";
  if (width <= 420 || height <= 360) return "xsmall";
  if (width <= 720 || height <= 520) return "small";
  if (width <= 1024 || height <= 720) return "medium";
  return "large";
};

export const computeStyles = (sizeClass: "large" | "medium" | "small" | "xsmall") => {
  const root: StyleMap = {
    width: "100%",
    height: "100vh",
    backgroundColor: "#000",
    color: "#f5f5f5",
    padding: 0,
    boxSizing: "border-box",
    position: "relative",
    overflow: "hidden",
    fontFamily: FONT_FAMILY,
  };

  const stage: StyleMap = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    zIndex: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const image: StyleMap = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    objectPosition: "center",
    boxShadow: "none",
    borderRadius: "0",
  };

  const caption: StyleMap = {
    position: "absolute",
    left: "50%",
    bottom: "88px",
    transform: "translateX(-50%)",
    zIndex: 10,
    padding: "10px 16px",
    borderRadius: "20px",
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: "14px",
    letterSpacing: "0.05em",
    textAlign: "center",
    maxWidth: "90vw",
    pointerEvents: "none",
  };

  const status: StyleMap = {
    position: "absolute",
    top: "32px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 12,
    padding: "8px 16px",
    borderRadius: "16px",
    background: "rgba(20,20,20,0.75)",
    fontSize: "13px",
    letterSpacing: "0.04em",
  };

  const controlBar: StyleMap = {
    position: "absolute",
    left: "50%",
    bottom: "32px",
    transform: "translateX(-50%)",
    zIndex: 11,
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "12px 20px",
    borderRadius: "24px",
    background: "rgba(20,20,20,0.85)",
    border: "1px solid rgba(255,255,255,0.15)",
    backdropFilter: "blur(10px)",
    maxWidth: "calc(100% - 24px)",
  };

  const slider: StyleMap = {
    minWidth: "150px",
    height: "4px",
    borderRadius: "2px",
    background: "rgba(255,255,255,0.2)",
    outline: "none",
    cursor: "pointer",
    WebkitAppearance: "none",
    appearance: "none",
    accentColor: "#4a9eff",
  };

  const sliderLabel = {
    fontSize: "12px",
    color: "#888",
    minWidth: "45px",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  };

  const button: StyleMap = {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.05)",
    color: "#f5f5f5",
    cursor: "pointer",
    fontSize: "12px",
    transition: "all 0.2s ease",
    fontFamily: FONT_FAMILY,
  };

  if (sizeClass === "medium") {
    caption.bottom = "72px";
    caption.fontSize = "13px";
    caption.maxWidth = "calc(100% - 24px)";
    controlBar.bottom = "20px";
  } else if (sizeClass === "small") {
    image.borderRadius = "0";
    caption.bottom = "60px";
    caption.fontSize = "12px";
    caption.maxWidth = "calc(100% - 24px)";
    status.top = "18px";
    status.fontSize = "12px";
    controlBar.padding = "10px 16px";
    controlBar.gap = "12px";
    controlBar.bottom = "16px";
    slider.minWidth = "120px";
    button.fontSize = "11px";
  } else if (sizeClass === "xsmall") {
    image.borderRadius = "0";
    caption.fontSize = "11px";
    caption.padding = "8px 12px";
    caption.maxWidth = "calc(100% - 24px)";
    caption.bottom = "108px";
    status.top = "12px";
    status.padding = "6px 12px";
    status.fontSize = "11px";
    controlBar.flexDirection = "column";
    controlBar.alignItems = "stretch";
    controlBar.gap = "12px";
    controlBar.padding = "10px 14px";
    controlBar.bottom = "12px";
    slider.minWidth = "100%";
    slider.width = "100%";
    sliderLabel.minWidth = "auto";
    sliderLabel.textAlign = "center";
    button.width = "100%";
    button.fontSize = "11px";
  }

  return { root, stage, image, caption, status, controlBar, slider, sliderLabel, button };
};

export const cleanId = (value: string | null | undefined) => (value ? value.replace(/:(en|zh)$/i, "") : value);

export const DISPLAY_ORDER = Array.from({ length: DEFAULT_SLIDE_TOP_K }, (_, i) => i);
export const BATCH_SIZE = DEFAULT_SLIDE_TOP_K;
export const buildDisplayOrder = (count: number) => Array.from({ length: count }, (_, i) => i);

export const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("無法產生截圖"));
          return;
        }
        resolve(blob);
      },
      "image/png",
    );
  });
