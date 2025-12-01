import type { MockInstance } from "vitest";
import { vi } from "vitest";

type AnyFunc = (...args: any[]) => any;

export type MockOf<T extends AnyFunc> = MockInstance<ReturnType<T>, Parameters<T>>;

export interface MockFetchOptions<T> {
  status?: number;
  ok?: boolean;
  statusText?: string;
  responseText?: string;
  data?: T;
}

export interface MockFetchResult<T> {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<T>;
  text: () => Promise<string>;
}

export function createMockFetch<T>(data: T, options: MockFetchOptions<T> = {}) {
  const status = options.status ?? 200;
  const ok = options.ok ?? (status >= 200 && status < 300);
  const statusText = options.statusText ?? (ok ? "OK" : "Error");
  const responseText = options.responseText ?? JSON.stringify(options.data ?? data);

  const response: MockFetchResult<T> = {
    ok,
    status,
    statusText,
    json: vi.fn(async () => data),
    text: vi.fn(async () => responseText),
  };

  const mockFetch = vi.fn(async () => response) as MockInstance<Promise<MockFetchResult<T>>, Parameters<typeof fetch>>;

  const install = () => {
    vi.stubGlobal("fetch", mockFetch as unknown as typeof fetch);
    return mockFetch;
  };

  return { mockFetch, response, install };
}

type FuncKeys<T> = { [K in keyof T]: T[K] extends AnyFunc ? K : never }[keyof T];

type MockMap<T> = {
  [K in keyof T]: T[K] extends AnyFunc ? MockOf<T[K]> : never;
};

export function createMockApi<T extends Record<string, AnyFunc>, K extends FuncKeys<T>>(
  keys: readonly K[],
  implementation?: Partial<{ [P in K]: T[P] }>,
) {
  const mocks = {} as MockMap<Pick<T, K>>;

  keys.forEach((key) => {
    const impl = implementation?.[key];
    const typedMock =
      impl != null
        ? vi.fn<Parameters<T[K]>, ReturnType<T[K]>>(impl as (...args: Parameters<T[K]>) => ReturnType<T[K]>)
        : vi.fn<Parameters<T[K]>, ReturnType<T[K]>>();
    (mocks as Record<K, MockOf<T[K]>>)[key] = typedMock as MockOf<T[K]>;
  });

  const factory = () =>
    keys.reduce((acc, key) => {
      (acc as Record<K, T[K]>)[key] = ((...args: Parameters<T[K]>) => {
        return (mocks as Record<K, MockOf<T[K]>>)[key](...args);
      }) as T[K];
      return acc;
    }, {} as Pick<T, K>);

  return { mocks, factory };
}
