import React, { createRef } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";

import Photo from "../../../src/components/kinship/scene/components/Photo";

const { frameCallbacks, mockUseTexture } = vi.hoisted(() => {
  const frameCallbacks: Array<(state: { clock: { getElapsedTime: () => number } }) => void> = [];
  const mockUseTexture = vi.fn(() => ({ image: undefined }));
  return { frameCallbacks, mockUseTexture };
});

vi.mock("@react-three/fiber", () => ({
  __esModule: true,
  useFrame: (cb?: (state: { clock: { getElapsedTime: () => number } }) => void) => {
    if (cb) frameCallbacks.push(cb);
  },
  useThree: () => ({ clock: { getElapsedTime: () => 0 } }),
}));

vi.mock("@react-three/drei", () => ({
  __esModule: true,
  Float: ({ children }: { children?: React.ReactNode }) => <div data-testid="float">{children}</div>,
  useTexture: () => mockUseTexture(),
}));

beforeEach(() => {
  frameCallbacks.splice(0, frameCallbacks.length);
  vi.clearAllMocks();
});

describe("Photo", () => {
  it("將節點指派給外部 ref，並在 useFrame 中調整縮放", () => {
    const onPick = vi.fn();
    const externalRef = createRef<HTMLElement | null>();

    const { container } = render(
      <Photo url="/base/hero" size={2} name="hero" onPick={onPick} externalRef={externalRef as any} />,
    );

    const mesh = container.querySelector("mesh") as HTMLElement & {
      scale?: { set?: (...args: number[]) => void };
      visible?: boolean;
    };
    expect(mesh).not.toBeNull();
    if (!mesh) throw new Error("mesh not found");

    mesh.scale = { set: vi.fn() };
    mesh.visible = true;

    const frame = frameCallbacks[0];
    expect(frame).toBeDefined();
    frame?.({ clock: { getElapsedTime: () => 1 } });

    expect(mesh.scale.set).toHaveBeenCalled();
    expect(externalRef.current).toBe(mesh);

    fireEvent.click(mesh);
    expect(onPick).toHaveBeenCalledWith("hero");
  });
});
