export const containerStyle = { padding: 16 };

export const tabRowStyle = { display: "flex", gap: 8, marginBottom: 12 };
export const tabPanelStyle = {};
export const hiddenTabPanelStyle = { ...tabPanelStyle, display: "none" };
export const tabButtonStyle = {
  padding: "8px 12px",
  borderRadius: 6,
  border: "1px solid #ccc",
  background: "#111",
  color: "#f5f5f5",
  cursor: "pointer",
  fontWeight: 600,
};
export const activeTabButtonStyle = {
  ...tabButtonStyle,
  background: "#fff",
  color: "#111",
  border: "1px solid #333",
};

export const boxStyle = {
  border: "1px solid #ccc",
  borderRadius: 8,
  padding: 12,
  marginBottom: 16,
  background: "#fafafa",
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

export const labelStyle = { display: "block", fontWeight: 600, marginBottom: 6 };

export const previewContainerStyle = {
  marginTop: 12,
  background: "#000",
  borderRadius: 10,
  padding: 12,
  position: "relative",
};

export const previewTitleStyle = { marginBottom: 6, fontWeight: 700, color: "#ddd" };

export const snapshotPreviewIframeStyle = {
  width: "100%",
  aspectRatio: "16 / 9",
  minHeight: 400,
  border: "1px solid #333",
  borderRadius: 8,
  background: "#111",
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
  border: "1px solid #333",
  borderRadius: 8,
  background: "#111",
};

export const resizerHandleStyle = {
  position: "absolute",
  right: 8,
  bottom: 8,
  width: 14,
  height: 14,
  borderRadius: 4,
  background: "#888",
  border: "1px solid #555",
  cursor: "nwse-resize",
  boxShadow: "0 0 0 2px #000",
};

export const resizerHitboxStyle = {
  position: "absolute",
  right: 0,
  bottom: 0,
  width: 32,
  height: 32,
  cursor: "nwse-resize",
};
