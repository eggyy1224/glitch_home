import React from "react";
import { boxStyle, labelStyle } from "../../AdminPanelStyles";

interface QueueTargetOption {
  value?: string;
  label: string;
}

interface QueueControlFormProps {
  type: string;
  targetId: string;
  priority: string;
  retries: number;
  etaSeconds: string;
  activeClient: string;
  loadingTargets: boolean;
  targetOptions: QueueTargetOption[];
  targetOptionsMessage: string;
  currentHeadline: string;
  onClientChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onTargetIdChange: (value: string) => void;
  onPriorityChange: (value: string) => void;
  onRetriesChange: (value: number) => void;
  onEtaChange: (value: string) => void;
  onLoadTargetOptions: () => void;
  onEnqueue: () => void;
}

export function QueueControlForm({
  type,
  targetId,
  priority,
  retries,
  etaSeconds,
  activeClient,
  loadingTargets,
  targetOptions,
  targetOptionsMessage,
  currentHeadline,
  onClientChange,
  onTypeChange,
  onTargetIdChange,
  onPriorityChange,
  onRetriesChange,
  onEtaChange,
  onLoadTargetOptions,
  onEnqueue,
}: QueueControlFormProps) {
  return (
    <div style={boxStyle} data-ai-role="state-queue.form-box">
      <h3 style={{ marginTop: 0 }}>佇列控制</h3>
      <div style={{ marginBottom: 4, color: "#82dca5", letterSpacing: "0.02em", fontSize: 12 }}>
        先選 client 與 type，再載入 target 選單 → 填寫數值後派送。
      </div>
      <div
        style={{ marginBottom: 8, color: "#82dca5", letterSpacing: "0.02em" }}
        role="status"
        aria-live="polite"
        data-ai-status="state-queue.headline"
        data-ai-role="state-queue.headline"
      >
        {currentHeadline}
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }} data-ai-role="queue.form-fields-primary">
        <div>
          <label style={labelStyle} htmlFor="queue-client">
            Client
          </label>
          <input
            id="queue-client"
            type="text"
            value={activeClient}
            onChange={(e) => onClientChange(e.target.value)}
            placeholder="client id"
            style={{ width: 180 }}
            data-ai-field="queue.client"
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="queue-type">
            類型
          </label>
          <select
            id="queue-type"
            value={type}
            onChange={(e) => onTypeChange(e.target.value)}
            style={{ padding: 6 }}
            data-ai-field="queue.type"
          >
            <option value="snapshot">snapshot</option>
            <option value="timeline">timeline</option>
            <option value="episode">episode</option>
            <option value="scene">scene</option>
            <option value="script">script</option>
          </select>
        </div>
        <div style={{ flex: 1 }} data-ai-role="queue.target-selector">
          <label style={labelStyle} htmlFor="queue-target">
            Target ID
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              id="queue-target"
              type="text"
              list="queue-target-options"
              value={targetId}
              onChange={(e) => onTargetIdChange(e.target.value)}
              placeholder="snapshot/timeline/episode/scene/script id"
              style={{ width: "100%" }}
              data-ai-field="queue.target-id"
              aria-describedby="queue-target-status"
            />
            <button
              type="button"
              onClick={onLoadTargetOptions}
              disabled={loadingTargets}
              style={{ padding: "6px 10px" }}
              data-ai-action="queue.load-options"
              data-testid="queue-load-options"
            >
              {loadingTargets ? "載入中" : "載入選單"}
            </button>
          </div>
          <datalist id="queue-target-options">
            {targetOptions.map((item) => (
              <option key={item.value} value={item.value} label={item.label} />
            ))}
          </datalist>
          <div
            id="queue-target-status"
            style={{ marginTop: 4, fontSize: 12, color: "#82dca5", letterSpacing: "0.02em" }}
            role="status"
            aria-live="polite"
            data-ai-status="queue.target-options-message"
          >
            {targetOptionsMessage || "尚未載入 target 選單"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }} data-ai-role="queue.form-fields-secondary">
        <div>
          <label style={labelStyle} htmlFor="queue-priority">
            Priority
          </label>
          <input
            id="queue-priority"
            type="number"
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value)}
            style={{ width: 120 }}
            placeholder="0"
            data-ai-field="queue.priority"
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="queue-retries">
            Retries
          </label>
          <input
            id="queue-retries"
            type="number"
            value={retries}
            onChange={(e) => onRetriesChange(Number(e.target.value))}
            style={{ width: 120 }}
            data-ai-field="queue.retries"
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="queue-eta">
            ETA (秒後)
          </label>
          <input
            id="queue-eta"
            type="number"
            value={etaSeconds}
            onChange={(e) => onEtaChange(e.target.value)}
            style={{ width: 140 }}
            placeholder="立即"
            data-ai-field="queue.eta"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onEnqueue}
        style={{ padding: "8px 14px", fontWeight: 700 }}
        data-ai-action="queue.enqueue"
        data-testid="queue-enqueue"
      >
        派送到佇列
      </button>
    </div>
  );
}
