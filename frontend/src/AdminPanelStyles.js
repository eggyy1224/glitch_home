const accent = "#0f4";
const accentStrong = "#4f8";
const border = "#0f4";
const borderStrong = "#0f4";
const text = "#c8ffd2";
const textMuted = "#82dca5";
const panelBg = "#000";
const panelBgAlt = "#000";
const panelShadow = "none";
const fontFamily = "monospace";

export const containerStyle = {
  padding: 16,
  position: "relative",
  zIndex: 1,
  color: text,
  fontFamily,
  lineHeight: 1.5,
};

export const tabRowStyle = { display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" };
export const tabPanelStyle = {};
export const hiddenTabPanelStyle = { ...tabPanelStyle, display: "none" };
export const tabButtonStyle = {
  padding: "10px 14px",
  borderRadius: 0,
  border: `1px solid ${border}`,
  background: "#000",
  color: text,
  cursor: "pointer",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};
export const activeTabButtonStyle = {
  ...tabButtonStyle,
  background: accent,
  color: "#000",
  border: `1px solid ${accentStrong}`,
  fontWeight: 700,
};

export const boxStyle = {
  border: `1px solid ${border}`,
  borderRadius: 0,
  padding: 12,
  marginBottom: 16,
  background: panelBgAlt,
  boxShadow: panelShadow,
};

export const columnsStyle = {
  display: "flex",
  gap: 16,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

export const columnStyle = {
  flex: 1,
  minWidth: 420,
};

export const labelStyle = {
  display: "block",
  fontWeight: 600,
  marginBottom: 6,
  letterSpacing: "0.05em",
  color: accentStrong,
};

export const previewContainerStyle = {
  marginTop: 12,
  background: panelBg,
  borderRadius: 0,
  padding: 12,
  position: "relative",
  border: `1px solid ${borderStrong}`,
  boxShadow: panelShadow,
};

export const previewTitleStyle = { marginBottom: 6, fontWeight: 800, color: textMuted, letterSpacing: "0.08em" };

export const snapshotPreviewIframeStyle = {
  width: "100%",
  aspectRatio: "16 / 9",
  minHeight: 400,
  border: `1px solid ${borderStrong}`,
  borderRadius: 0,
  background: "#000",
  boxShadow: "none",
};

export const timelinePreviewGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 12,
  marginTop: 12,
};

export const timelinePreviewIframeStyle = {
  width: "100%",
  aspectRatio: "16 / 9",
  minHeight: 340,
  border: `1px solid ${borderStrong}`,
  borderRadius: 0,
  background: "#000",
  boxShadow: "none",
};

export const resizerHandleStyle = {
  position: "absolute",
  right: 8,
  bottom: 8,
  width: 14,
  height: 14,
  borderRadius: 0,
  background: "#000",
  border: `1px solid ${border}`,
  cursor: "nwse-resize",
  boxShadow: "none",
};

export const resizerHitboxStyle = {
  position: "absolute",
  right: 0,
  bottom: 0,
  width: 32,
  height: 32,
  cursor: "nwse-resize",
};
