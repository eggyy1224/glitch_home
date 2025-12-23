import React, { useCallback, useEffect, useMemo, useState } from "react";
import { boxStyle, columnStyle, columnsStyle, labelStyle } from "../AdminPanelStyles";
import { deleteSchedule, deploySchedule, getSchedule, listSchedules, saveSchedule } from "../api";
import type { ScheduleDefinition, ScheduleDeployResult, ScheduleEvent, ScheduleEventType, ScheduleSummary } from "../types/schedule";

interface ScheduleEventDraft {
  id: string;
  time: string;
  type: ScheduleEventType;
  target_id: string;
  client_id: string;
  enabled: boolean;
  payloadText: string;
  notes: string;
}

const DEFAULT_TIMEZONE = "Asia/Taipei";

function createEventId() {
  return `evt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function draftFromEvent(event: ScheduleEvent): ScheduleEventDraft {
  return {
    id: event.id || createEventId(),
    time: event.time || "09:00",
    type: event.type || "snapshot",
    target_id: event.target_id || "",
    client_id: event.client_id || "",
    enabled: event.enabled ?? true,
    payloadText: event.payload ? JSON.stringify(event.payload, null, 2) : "",
    notes: event.notes || "",
  };
}

function serializeEvents(events: ScheduleEventDraft[]) {
  return events.map((event) => {
    let payload: Record<string, unknown> | null = null;
    if (event.payloadText.trim()) {
      payload = JSON.parse(event.payloadText);
    }
    return {
      id: event.id,
      time: event.time,
      type: event.type,
      target_id: event.target_id,
      client_id: event.client_id ? event.client_id : null,
      enabled: event.enabled,
      payload,
      notes: event.notes ? event.notes : null,
    };
  });
}

export default function ScheduleManager() {
  const [scheduleList, setScheduleList] = useState<ScheduleSummary[]>([]);
  const [scheduleId, setScheduleId] = useState("");
  const [scheduleTitle, setScheduleTitle] = useState("");
  const [scheduleTimezone, setScheduleTimezone] = useState(DEFAULT_TIMEZONE);
  const [scheduleStatus, setScheduleStatus] = useState<"active" | "paused">("active");
  const [events, setEvents] = useState<ScheduleEventDraft[]>([]);
  const [message, setMessage] = useState("");
  const [deployResult, setDeployResult] = useState<ScheduleDeployResult | null>(null);
  const [deployDryRun, setDeployDryRun] = useState(false);
  const [staggerSeconds, setStaggerSeconds] = useState("2");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [loading, setLoading] = useState(false);

  const refreshScheduleList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSchedules();
      setScheduleList(Array.isArray(data?.schedules) ? data.schedules : []);
    } catch (err) {
      setMessage((err as Error)?.message || "載入排程清單失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshScheduleList();
  }, [refreshScheduleList]);

  const handleLoadSchedule = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const data = await getSchedule(id);
      const schedule = data?.schedule;
      if (!schedule) {
        setMessage("找不到排程資料");
        return;
      }
      setScheduleId(schedule.id || id);
      setScheduleTitle(schedule.title || "");
      setScheduleTimezone(schedule.timezone || DEFAULT_TIMEZONE);
      setScheduleStatus((schedule.status as "active" | "paused") || "active");
      setEvents((schedule.events || []).map(draftFromEvent));
      setDeployResult(null);
      setMessage(`已載入排程 ${schedule.id}`);
    } catch (err) {
      setMessage((err as Error)?.message || "載入排程失敗");
    }
  }, []);

  const handleNewSchedule = useCallback(() => {
    setScheduleId("");
    setScheduleTitle("");
    setScheduleTimezone(DEFAULT_TIMEZONE);
    setScheduleStatus("active");
    setEvents([]);
    setDeployResult(null);
    setMessage("已建立新排程草稿");
  }, []);

  const handleSaveSchedule = useCallback(async () => {
    if (!scheduleId.trim()) {
      setMessage("請輸入 schedule id");
      return;
    }
    try {
      const payload: ScheduleDefinition = {
        id: scheduleId.trim(),
        title: scheduleTitle.trim(),
        timezone: scheduleTimezone || DEFAULT_TIMEZONE,
        status: scheduleStatus,
        repeat: "daily",
        events: serializeEvents(events),
      };
      const data = await saveSchedule(scheduleId.trim(), payload);
      const saved = data?.schedule;
      if (saved) {
        setScheduleId(saved.id);
        setScheduleTitle(saved.title || "");
        setScheduleTimezone(saved.timezone || DEFAULT_TIMEZONE);
        setScheduleStatus((saved.status as "active" | "paused") || "active");
        setEvents((saved.events || []).map(draftFromEvent));
      }
      setDeployResult(null);
      setMessage(`已儲存排程 ${scheduleId.trim()}`);
      await refreshScheduleList();
    } catch (err) {
      setMessage((err as Error)?.message || "儲存排程失敗");
    }
  }, [events, refreshScheduleList, scheduleId, scheduleStatus, scheduleTimezone, scheduleTitle]);

  const handleDeleteSchedule = useCallback(async () => {
    if (!scheduleId.trim()) {
      setMessage("請先選擇 schedule");
      return;
    }
    try {
      await deleteSchedule(scheduleId.trim());
      setMessage(`已刪除排程 ${scheduleId.trim()}`);
      handleNewSchedule();
      await refreshScheduleList();
    } catch (err) {
      setMessage((err as Error)?.message || "刪除排程失敗");
    }
  }, [handleNewSchedule, refreshScheduleList, scheduleId]);

  const handleDeploySchedule = useCallback(async () => {
    if (!scheduleId.trim()) {
      setMessage("請先選擇 schedule");
      return;
    }
    const stagger = Number(staggerSeconds);
    try {
      const result = await deploySchedule(scheduleId.trim(), {
        dry_run: deployDryRun,
        stagger_seconds: Number.isNaN(stagger) ? 2 : stagger,
        skip_duplicates: skipDuplicates,
      });
      setDeployResult(result);
      const createdCount = result.created?.length || 0;
      const plannedCount = result.planned?.length || 0;
      setMessage(deployDryRun ? `已預覽 ${plannedCount} 筆事件` : `已部署 ${createdCount} 筆事件`);
    } catch (err) {
      setMessage((err as Error)?.message || "部署排程失敗");
    }
  }, [deployDryRun, scheduleId, skipDuplicates, staggerSeconds]);

  const addEvent = useCallback(() => {
    setEvents((prev) => [
      ...prev,
      {
        id: createEventId(),
        time: "09:00",
        type: "snapshot",
        target_id: "",
        client_id: "",
        enabled: true,
        payloadText: "",
        notes: "",
      },
    ]);
  }, []);

  const updateEvent = useCallback((index: number, patch: Partial<ScheduleEventDraft>) => {
    setEvents((prev) => prev.map((event, idx) => (idx === index ? { ...event, ...patch } : event)));
  }, []);

  const removeEvent = useCallback((index: number) => {
    setEvents((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const deploySummary = useMemo(() => {
    if (!deployResult) return "";
    const planned = deployResult.planned?.length || 0;
    const created = deployResult.created?.length || 0;
    const skipped = deployResult.skipped?.length || 0;
    return deployResult.dry_run ? `預覽 ${planned} 筆 / 略過 ${skipped} 筆` : `部署 ${created} 筆 / 略過 ${skipped} 筆`;
  }, [deployResult]);

  return (
    <section style={{ width: "100%" }} data-ai-section="admin.schedule">
      <div style={boxStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>時間表排程</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={refreshScheduleList} style={{ padding: "6px 10px" }}>
              重新整理
            </button>
            <button type="button" onClick={handleNewSchedule} style={{ padding: "6px 10px" }}>
              新建排程
            </button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#82dca5", marginBottom: 8 }}>
          以每日固定時間點排程，可搭配 Snapshot / Timeline / Episode / Scene / Script。預設時區為 Asia/Taipei。
        </div>
        <div style={{ fontSize: 12, color: "#82dca5" }} role="status" aria-live="polite">
          {loading ? "載入中..." : message || " "}
          {deploySummary && <span style={{ marginLeft: 8 }}>({deploySummary})</span>}
        </div>
      </div>

      <div style={columnsStyle}>
        <div style={{ ...columnStyle, minWidth: 280 }}>
          <div style={boxStyle}>
            <h4 style={{ marginTop: 0 }}>排程清單</h4>
            {scheduleList.length === 0 ? (
              <div style={{ color: "#82dca5" }}>尚無排程</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                {scheduleList.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleLoadSchedule(item.id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "6px 8px",
                        border: "1px solid #0f4",
                        background: item.id === scheduleId ? "#020" : "#000",
                        color: "#e1ffe9",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{item.id}</div>
                      <div style={{ fontSize: 12, color: "#82dca5" }}>
                        {item.title || "未命名"} · {item.status || "active"} · {item.event_count ?? 0} events
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div style={{ ...columnStyle, minWidth: 540 }}>
          <div style={boxStyle}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="schedule-id">
                  Schedule ID
                </label>
                <input
                  id="schedule-id"
                  type="text"
                  value={scheduleId}
                  onChange={(e) => setScheduleId(e.target.value)}
                  placeholder="daily_show"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="schedule-title">
                  標題
                </label>
                <input
                  id="schedule-title"
                  type="text"
                  value={scheduleTitle}
                  onChange={(e) => setScheduleTitle(e.target.value)}
                  placeholder="每日排程"
                  style={{ width: "100%" }}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="schedule-status">
                  狀態
                </label>
                <select
                  id="schedule-status"
                  value={scheduleStatus}
                  onChange={(e) => setScheduleStatus(e.target.value as "active" | "paused")}
                  style={{ width: "100%", padding: 6 }}
                >
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle} htmlFor="schedule-timezone">
                時區
              </label>
              <input
                id="schedule-timezone"
                type="text"
                value={scheduleTimezone}
                onChange={(e) => setScheduleTimezone(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <button type="button" onClick={handleSaveSchedule} style={{ padding: "8px 12px", fontWeight: 700 }}>
                儲存排程
              </button>
              <button type="button" onClick={handleDeleteSchedule} style={{ padding: "8px 12px" }}>
                刪除排程
              </button>
              <button type="button" onClick={handleDeploySchedule} style={{ padding: "8px 12px", fontWeight: 700 }}>
                {deployDryRun ? "預覽部署" : "部署排程"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={deployDryRun} onChange={(e) => setDeployDryRun(e.target.checked)} />
                Dry run
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                />
                避免重複
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                錯峰秒數
                <input
                  type="number"
                  value={staggerSeconds}
                  onChange={(e) => setStaggerSeconds(e.target.value)}
                  style={{ width: 80 }}
                />
              </label>
            </div>
          </div>

          <div style={boxStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h4 style={{ margin: 0 }}>事件列表</h4>
              <button type="button" onClick={addEvent} style={{ padding: "6px 10px" }}>
                新增事件
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th>time</th>
                    <th>type</th>
                    <th>target</th>
                    <th>client</th>
                    <th>payload</th>
                    <th>on</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event, index) => (
                    <tr key={event.id}>
                      <td>
                        <input
                          type="time"
                          step={1}
                          value={event.time}
                          onChange={(e) => updateEvent(index, { time: e.target.value })}
                          style={{ width: 110 }}
                        />
                      </td>
                      <td>
                        <select
                          value={event.type}
                          onChange={(e) => updateEvent(index, { type: e.target.value as ScheduleEventType })}
                          style={{ padding: 4 }}
                        >
                          <option value="snapshot">snapshot</option>
                          <option value="timeline">timeline</option>
                          <option value="episode">episode</option>
                          <option value="scene">scene</option>
                          <option value="script">script</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={event.target_id}
                          onChange={(e) => updateEvent(index, { target_id: e.target.value })}
                          placeholder="target id"
                          style={{ width: 160 }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={event.client_id}
                          onChange={(e) => updateEvent(index, { client_id: e.target.value })}
                          placeholder="optional"
                          style={{ width: 120 }}
                        />
                      </td>
                      <td>
                        <textarea
                          value={event.payloadText}
                          onChange={(e) => updateEvent(index, { payloadText: e.target.value })}
                          placeholder='{"auto_play": true}'
                          rows={2}
                          style={{ width: 220 }}
                        />
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={event.enabled}
                          onChange={(e) => updateEvent(index, { enabled: e.target.checked })}
                        />
                      </td>
                      <td>
                        <button type="button" onClick={() => removeEvent(index)} style={{ padding: "4px 8px" }}>
                          刪除
                        </button>
                      </td>
                    </tr>
                  ))}
                  {events.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: 8, color: "#82dca5" }}>
                        尚未新增事件
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
