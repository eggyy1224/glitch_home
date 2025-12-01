import type { MutableRefObject } from "react";
import { vi } from "vitest";

export function createRefWithValue<T>(value: T): MutableRefObject<T> {
  return { current: value };
}

export function createNullableRef<T>(value: T | null = null): MutableRefObject<T | null> {
  return { current: value };
}

export function createElementRef<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options: { id?: string; className?: string; attach?: boolean } = {},
): MutableRefObject<HTMLElementTagNameMap[K]> {
  const element = document.createElement(tagName);
  if (options.id) element.id = options.id;
  if (options.className) element.className = options.className;
  if (options.attach) {
    document.body.appendChild(element);
  }
  return { current: element };
}

export async function flushPromises(): Promise<void> {
  await Promise.resolve();
}

export async function flushTimers(): Promise<void> {
  await vi.runAllTimersAsync();
  await flushPromises();
}

export async function withFakeTimers<T>(run: () => T | Promise<T>): Promise<T> {
  vi.useFakeTimers();
  try {
    const result = run();
    if (result instanceof Promise) {
      const awaited = await result;
      await flushTimers();
      return awaited;
    }
    await flushTimers();
    return result;
  } finally {
    vi.useRealTimers();
  }
}
