import { useCallback, useEffect, useRef, useState } from "react";
import { deleteCameraPreset, fetchCameraPresets, saveCameraPreset } from "../api.js";

export function useCameraPresets() {
  const [cameraInfo, setCameraInfo] = useState(null);
  const [cameraPresets, setCameraPresets] = useState([]);
  const [selectedPresetName, setSelectedPresetName] = useState("");
  const [pendingPreset, setPendingPreset] = useState(null);
  const [presetMessage, setPresetMessage] = useState(null);
  const messageTimerRef = useRef(null);

  useEffect(() => {
    fetchCameraPresets()
      .then((list) => {
        const arr = Array.isArray(list) ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : [];
        setCameraPresets(arr);
        const defaultPreset = arr.find((p) => p.name === "center");
        if (defaultPreset) {
          setSelectedPresetName(defaultPreset.name);
          setPendingPreset({ ...defaultPreset, key: Date.now() });
        }
      })
      .catch(() => setCameraPresets([]));
  }, []);

  const pushPresetMessage = useCallback((text, ttl = 2500) => {
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

  const upsertPresetInState = useCallback((preset) => {
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

  const removePresetInState = useCallback((name) => {
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
      const saved = await saveCameraPreset(payload);
      upsertPresetInState(saved);
      setSelectedPresetName(saved.name);
      pushPresetMessage(`視角 "${saved.name}" 已儲存。`);
    } catch (err) {
      window.alert(`儲存失敗：${err.message || err}`);
    }
  }, [cameraInfo, pushPresetMessage, upsertPresetInState]);

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
      await deleteCameraPreset(selectedPresetName);
      removePresetInState(selectedPresetName);
      pushPresetMessage(`視角 "${selectedPresetName}" 已刪除。`, 2000);
      setSelectedPresetName("");
    } catch (err) {
      window.alert(`刪除失敗：${err.message || err}`);
    }
  }, [selectedPresetName, pushPresetMessage, removePresetInState]);

  const handleCameraUpdate = useCallback((info) => {
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
