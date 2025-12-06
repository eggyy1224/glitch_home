import { useCallback, useEffect, useRef, useState } from "react";
import { deleteCameraPreset, fetchCameraPresets, saveCameraPreset } from "../api";
import type { CameraInfo, CameraPreset, CameraVector } from "../types/control";
import type { CameraPreset as ApiCameraPreset } from "../api";

export interface UseCameraPresetsOptions {
  scope?: string;
}

const toVector = (value: unknown): CameraVector => {
  const obj = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const x = typeof obj.x === "number" ? obj.x : 0;
  const y = typeof obj.y === "number" ? obj.y : 0;
  const z = typeof obj.z === "number" ? obj.z : 0;
  return { x, y, z };
};

const normalizePreset = (preset: ApiCameraPreset): CameraPreset => ({
  name: preset.name,
  position: toVector(preset.position),
  target: toVector(preset.target),
  scope: typeof preset.scope === "string" ? preset.scope : null,
});

export function useCameraPresets(options: UseCameraPresetsOptions = {}) {
  const { scope } = options;
  const [cameraInfo, setCameraInfo] = useState<CameraInfo | null>(null);
  const [cameraPresets, setCameraPresets] = useState<CameraPreset[]>([]);
  const [selectedPresetName, setSelectedPresetName] = useState("");
  const [pendingPreset, setPendingPreset] = useState<(CameraPreset & { key?: number }) | null>(null);
  const [presetMessage, setPresetMessage] = useState<string | null>(null);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchCameraPresets({ scope })
      .then((list) => {
        const arr = Array.isArray(list)
          ? [...list].map((item) => normalizePreset(item)).sort((a, b) => a.name.localeCompare(b.name))
          : [];
        setCameraPresets(arr);
        const defaultPreset = arr.find((p) => p.name === "center");
        if (defaultPreset) {
          setSelectedPresetName(defaultPreset.name);
          setPendingPreset({ ...defaultPreset, key: Date.now() });
        }
      })
      .catch(() => setCameraPresets([]));
  }, [scope]);

  const pushPresetMessage = useCallback((text: string, ttl = 2500) => {
    setPresetMessage(text);
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
    }
    messageTimerRef.current = setTimeout(() => {
      setPresetMessage(null);
      messageTimerRef.current = null;
    }, ttl);
  }, []);

  useEffect(() => {
    return () => {
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
    };
  }, []);

  const upsertPresetInState = useCallback((preset: CameraPreset) => {
    setCameraPresets((prev) => {
      const next = [...prev];
      const idx = next.findIndex((p) => p.name === preset.name);
      if (idx >= 0) {
        next[idx] = preset;
      } else {
        next.push(preset);
      }
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }, []);

  const removePresetInState = useCallback((name: string) => {
    setCameraPresets((prev) => prev.filter((p) => p.name !== name));
  }, []);

  const handleSavePreset = useCallback(async () => {
    if (!cameraInfo) {
      window.alert("尚未取得視角資訊，請稍後再試或移動視角。");
      return;
    }
    const rawName = window.prompt("請輸入要儲存的視角名稱：");
    if (!rawName) return;
    const name = rawName.trim();
    if (!name) return;
    const payload = {
      name,
      position: cameraInfo.position,
      target: cameraInfo.target,
    };
    try {
      const saved = await saveCameraPreset(payload, { scope });
      const normalized = normalizePreset(saved);
      upsertPresetInState(normalized);
      setSelectedPresetName(normalized.name);
      pushPresetMessage(`視角 "${normalized.name}" 已儲存。`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      window.alert(`儲存失敗：${message}`);
    }
  }, [cameraInfo, scope, pushPresetMessage, upsertPresetInState]);

  const handleApplyPreset = useCallback(() => {
    if (!selectedPresetName) return;
    const preset = cameraPresets.find((p) => p.name === selectedPresetName);
    if (!preset) return;
    setPendingPreset({ ...preset, key: Date.now() });
    pushPresetMessage(`已套用視角 "${preset.name}"。`, 2000);
  }, [cameraPresets, selectedPresetName, pushPresetMessage]);

  const handleDeletePreset = useCallback(async () => {
    if (!selectedPresetName) return;
    const ok = window.confirm(`確定要刪除視角 "${selectedPresetName}" 嗎？`);
    if (!ok) return;
    try {
      await deleteCameraPreset(selectedPresetName, { scope });
      removePresetInState(selectedPresetName);
      pushPresetMessage(`視角 "${selectedPresetName}" 已刪除。`, 2000);
      setSelectedPresetName("");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      window.alert(`刪除失敗：${message}`);
    }
  }, [selectedPresetName, scope, pushPresetMessage, removePresetInState]);

  const handleCameraUpdate = useCallback((info: CameraInfo | null) => {
    setCameraInfo(info);
  }, []);

  return {
    cameraInfo,
    cameraPresets,
    selectedPresetName,
    pendingPreset,
    presetMessage,
    setSelectedPresetName,
    handleCameraUpdate,
    handleSavePreset,
    handleApplyPreset,
    handleDeletePreset,
  };
}
