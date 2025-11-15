const FONT_FAMILY = "'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif";

export const SlideSourceMode = Object.freeze({
  VECTOR: "vector",
  KINSHIP: "kinship",
});

export const getSlideSourceMode = (params) => {
  const mode = (params?.get("slide_source") || SlideSourceMode.VECTOR).toLowerCase();
  return mode === SlideSourceMode.KINSHIP ? SlideSourceMode.KINSHIP : SlideSourceMode.VECTOR;
};

export const getSizeClass = (width, height) => {
  if (!width || !height) return "large";
  if (width <= 420 || height <= 360) return "xsmall";
  if (width <= 720 || height <= 520) return "small";
  if (width <= 1024 || height <= 720) return "medium";
  return "large";
};

export const computeStyles = (sizeClass) => {
  const root = {
    width: "100vw",
    height: "100vh",
    backgroundColor: "#000",
    color: "#f5f5f5",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "64px 32px 140px",
    boxSizing: "border-box",
    gap: "24px",
    position: "relative",
    overflow: "hidden",
    fontFamily: FONT_FAMILY,
  };

  const stage = {
    width: "100%",
    maxWidth: "90vw",
    maxHeight: "100%",
    minHeight: 0,
    flex: "1 1 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const image = {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
    borderRadius: "12px",
  };

  const caption = {
    padding: "10px 16px",
    borderRadius: "20px",
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: "14px",
    letterSpacing: "0.05em",
    textAlign: "center",
    maxWidth: "90vw",
  };

  const status = {
    position: "absolute",
    top: "32px",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "8px 16px",
    borderRadius: "16px",
    background: "rgba(20,20,20,0.75)",
    fontSize: "13px",
    letterSpacing: "0.04em",
  };

  const controlBar = {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "12px 20px",
    borderRadius: "24px",
    background: "rgba(20,20,20,0.85)",
    border: "1px solid rgba(255,255,255,0.15)",
    backdropFilter: "blur(10px)",
  };

  const slider = {
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

  const button = {
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
    root.padding = "48px 24px 72px";
    stage.maxWidth = "100%";
    caption.maxWidth = "100%";
    caption.fontSize = "13px";
  } else if (sizeClass === "small") {
    root.padding = "24px 16px 32px";
    root.gap = "16px";
    stage.maxWidth = "100%";
    stage.maxHeight = "100%";
    image.boxShadow = "0 12px 40px rgba(0,0,0,0.55)";
    image.borderRadius = "10px";
    caption.fontSize = "12px";
    caption.maxWidth = "100%";
    status.top = "18px";
    status.fontSize = "12px";
    controlBar.padding = "10px 16px";
    controlBar.gap = "12px";
    slider.minWidth = "120px";
    button.fontSize = "11px";
  } else if (sizeClass === "xsmall") {
    root.padding = "12px";
    root.gap = "12px";
    stage.maxWidth = "100%";
    stage.maxHeight = "100%";
    image.boxShadow = "0 10px 28px rgba(0,0,0,0.5)";
    image.borderRadius = "10px";
    caption.fontSize = "11px";
    caption.padding = "8px 12px";
    caption.maxWidth = "100%";
    status.top = "12px";
    status.padding = "6px 12px";
    status.fontSize = "11px";
    controlBar.flexDirection = "column";
    controlBar.alignItems = "stretch";
    controlBar.gap = "12px";
    controlBar.padding = "10px 14px";
    slider.minWidth = "100%";
    slider.width = "100%";
    sliderLabel.minWidth = "auto";
    sliderLabel.textAlign = "center";
    button.width = "100%";
    button.fontSize = "11px";
  }

  return { root, stage, image, caption, status, controlBar, slider, sliderLabel, button };
};

export const cleanId = (value) => (value ? value.replace(/:(en|zh)$/i, "") : value);

export const DISPLAY_ORDER = Array.from({ length: 15 }, (_, i) => i);
export const BATCH_SIZE = 15;

export const canvasToBlob = (canvas) =>
  new Promise((resolve, reject) => {
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
