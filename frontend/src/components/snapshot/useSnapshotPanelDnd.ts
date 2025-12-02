import { useCallback } from "react";
import type { PanelConfig } from "./types";

export const PANEL_DRAG_TYPE = "application/x-snapshot-panel-index";
export const ASSET_DRAG_TYPE = "application/x-snapshot-asset";
export const ASSET_TYPE_DRAG_TYPE = "application/x-snapshot-asset-type";

interface UseSnapshotPanelDndArgs {
  panels: PanelConfig[];
  onMoveRow: (index: number, delta: number) => void;
  applyAssetToPanel: (index: number, asset: string, assetType?: "video" | "image") => void;
  onSelectPanel?: (index: number) => void;
}

export function useSnapshotPanelDnd({ panels, onMoveRow, applyAssetToPanel, onSelectPanel }: UseSnapshotPanelDndArgs) {
  const handlePanelDrag = useCallback((event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(PANEL_DRAG_TYPE, String(index));
    event.dataTransfer.setData("text/plain", `panel:${index}`);
  }, []);

  const handlePanelDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
      const assetPayload = event.dataTransfer.getData(ASSET_DRAG_TYPE);
      const assetTypePayload = event.dataTransfer.getData(ASSET_TYPE_DRAG_TYPE);
      if (assetPayload) {
        const assetType = (assetTypePayload as "video" | "image" | "") || undefined;
        applyAssetToPanel(targetIndex, assetPayload, assetType);
        return;
      }

      const panelPayload = event.dataTransfer.getData(PANEL_DRAG_TYPE);
      const raw = panelPayload || event.dataTransfer.getData("text/plain");
      if (!raw) return;

      if (raw.startsWith("asset:")) {
        const assetType = (assetTypePayload as "video" | "image" | "") || undefined;
        applyAssetToPanel(targetIndex, raw.replace(/^asset:/, ""), assetType);
        return;
      }

      const numericRaw = raw.startsWith("panel:") ? raw.replace(/^panel:/, "") : raw;
      const from = Number(numericRaw);
      if (Number.isNaN(from)) return;
      if (from === targetIndex) return;

      const rect = event.currentTarget?.getBoundingClientRect?.();
      const dropAfter =
        rect != null
          ? event.clientY - rect.top > rect.height / 2 || event.clientX - rect.left > rect.width / 2
          : targetIndex > from; // fallback: when moving downward, default to drop-after

      let insertIndex = null;
      if (targetIndex > from) {
        const isAdjacent = targetIndex === from + 1;
        insertIndex = isAdjacent ? targetIndex : dropAfter ? targetIndex : targetIndex - 1; // adjacent downward always moves
      } else if (targetIndex < from) {
        insertIndex = dropAfter ? targetIndex + 1 : targetIndex;
      }
      if (insertIndex == null) return;

      const maxIndex = Math.max(0, (panels?.length || 1) - 1);
      const clampedIndex = Math.max(0, Math.min(insertIndex, maxIndex));
      onMoveRow(from, clampedIndex - from);
      if (typeof onSelectPanel === "function") {
        onSelectPanel(clampedIndex);
      }
    },
    [applyAssetToPanel, onMoveRow, onSelectPanel, panels],
  );

  return {
    handlePanelDrag,
    handlePanelDrop,
  };
}
