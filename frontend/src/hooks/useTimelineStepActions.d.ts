import type { AppModeCapabilities } from "../types/control";
import type { TimelineStep } from "../types/admin";

export interface TimelineStepActionOptions {
  clientId?: string;
  onError?: (message: string | null) => void;
  capabilities?: Partial<AppModeCapabilities> & { forbidMessage?: string };
}

export interface TimelineStepActionHandlers {
  executeStepActions: (options: {
    step: TimelineStep;
    timelineId?: string | null;
    stepIndex?: number;
    runId: number;
  }) => Promise<void> | void;
  actionError: string | null;
  clearActionError: () => void;
  cancelPendingActions: () => void;
}

export function useTimelineStepActions(options?: TimelineStepActionOptions): TimelineStepActionHandlers;
