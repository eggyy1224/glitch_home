import { useCallback, useEffect, useState } from "react";
import { listIframeSnapshots } from "../api";
import type { SnapshotEntry } from "../types/timeline";
import type { EditorMode } from "../utils/adminEditorUtils";

export type SnapshotOption = SnapshotEntry & { id?: string; client: string };

interface UseSnapshotListParams {
  defaultClientId?: string | null;
  setMessageForMode: (value: string, targetMode?: EditorMode) => void;
}

export default function useSnapshotList({ defaultClientId, setMessageForMode }: UseSnapshotListParams) {
  const [snapshotClient, setSnapshotClient] = useState(defaultClientId);
  const [snapshotKeyword, setSnapshotKeyword] = useState("");
  const [snapshotName, setSnapshotName] = useState("new_snapshot");
  const [snapshotOptions, setSnapshotOptions] = useState<SnapshotOption[]>([]);
  const [snapshotMessage, setSnapshotMessage] = useState("");

  const refreshSnapshots = useCallback(
    async (clientOverride?: string | null) => {
      try {
        const targetClient = clientOverride ?? snapshotClient;
        const data = await listIframeSnapshots(targetClient || null);
        const list = Array.isArray(data.snapshots) ? data.snapshots : [];
        const filtered = snapshotKeyword
          ? list.filter(
              (item) => `${item.id || item.name}`.includes(snapshotKeyword) || `${item.client}`.includes(snapshotKeyword),
            )
          : list;
        const normalized: SnapshotOption[] = filtered.map((item) => ({
          ...(item as SnapshotEntry),
          client: item.client || (item as { client_id?: string }).client_id || targetClient || "",
        }));
        setSnapshotOptions(normalized);
        setSnapshotMessage(`取得 ${filtered.length} 筆 snapshot`);
        setMessageForMode(`取得 ${filtered.length} 筆 snapshot`, "snapshot");
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : "載入 snapshot 清單失敗";
        setSnapshotMessage(errMessage);
        setMessageForMode(errMessage, "snapshot");
      }
    },
    [setMessageForMode, snapshotClient, snapshotKeyword],
  );

  useEffect(() => {
    setSnapshotClient(defaultClientId);
    setSnapshotName("new_snapshot");
  }, [defaultClientId]);

  return {
    snapshotClient,
    setSnapshotClient,
    snapshotKeyword,
    setSnapshotKeyword,
    snapshotName,
    setSnapshotName,
    snapshotOptions,
    snapshotMessage,
    refreshSnapshots,
  };
}
