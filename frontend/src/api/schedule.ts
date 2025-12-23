import { apiClient } from "./client";
import type { ScheduleDefinition, ScheduleDeployResult, ScheduleSummary } from "../types/schedule";
import type { RequestOptions } from "../utils/request";

export async function listSchedules({ signal }: RequestOptions = {}): Promise<{ schedules?: ScheduleSummary[] }> {
  return apiClient.get(`/api/schedules`, { signal });
}

export async function getSchedule(scheduleId: string, { signal }: RequestOptions = {}): Promise<{ schedule?: ScheduleDefinition }> {
  if (!scheduleId) throw new Error("scheduleId is required");
  return apiClient.get(`/api/schedules/${encodeURIComponent(scheduleId)}`, { signal });
}

export async function saveSchedule(
  scheduleId: string,
  payload: ScheduleDefinition,
  { signal }: RequestOptions = {},
): Promise<{ schedule?: ScheduleDefinition }> {
  if (!scheduleId) throw new Error("scheduleId is required");
  return apiClient.put(`/api/schedules/${encodeURIComponent(scheduleId)}`, payload, { signal });
}

export async function deleteSchedule(scheduleId: string, { signal }: RequestOptions = {}): Promise<unknown> {
  if (!scheduleId) throw new Error("scheduleId is required");
  return apiClient.del(`/api/schedules/${encodeURIComponent(scheduleId)}`, { signal });
}

export async function deploySchedule(
  scheduleId: string,
  body: { dry_run?: boolean; stagger_seconds?: number; skip_duplicates?: boolean } = {},
  { signal }: RequestOptions = {},
): Promise<ScheduleDeployResult> {
  if (!scheduleId) throw new Error("scheduleId is required");
  return apiClient.post(`/api/schedules/${encodeURIComponent(scheduleId)}/deploy`, body, { signal });
}
