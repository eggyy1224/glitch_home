import type { RequestOptions } from "../utils/request";

export interface ResolveOption extends RequestOptions {
  resolve?: boolean;
  version?: number;
  expectedVersion?: number;
}

export interface TargetClientOption {
  targetClientId?: string | null;
}
