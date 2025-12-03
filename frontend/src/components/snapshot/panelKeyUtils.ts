import type { PanelConfig } from "./types";

export function createPanelKeyResolver(panels?: PanelConfig[] | null) {
  const counts: Record<string, number> = {};
  (panels || []).forEach((panel) => {
    const id = typeof panel?.id === "string" ? panel.id.trim() : "";
    if (!id) return;
    counts[id] = (counts[id] || 0) + 1;
  });

  return (panel: PanelConfig, index: number) => {
    const id = typeof panel?.id === "string" ? panel.id.trim() : "";
    if (id && counts[id] === 1) return id;
    return `${id || "panel"}-${index}`;
  };
}
