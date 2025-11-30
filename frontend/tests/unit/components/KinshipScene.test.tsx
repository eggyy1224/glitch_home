// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import KinshipScene from "../../../src/components/kinship/KinshipScene";
import {
  KINSHIP_MODE_CONFIGS,
  KinshipModes,
  selectKinshipMode,
} from "../../../src/components/kinship/hooks/useKinshipModeSelection";

const {
  PhylogenySceneMock,
  IncubatorSceneMock,
  SceneClustersMock,
  handleCreatedMock,
} = vi.hoisted(() => {
  const stub = (name) => vi.fn((props) => <div data-testid={name} data-props={JSON.stringify(props)} />);
  return {
    PhylogenySceneMock: stub("phylogeny"),
    IncubatorSceneMock: stub("incubator"),
    SceneClustersMock: stub("clusters"),
    handleCreatedMock: vi.fn(),
  };
});

vi.mock("@react-three/fiber", () => {
  const controlsStub = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    target: { x: 0, y: 0, z: 0 },
  };
  const cameraStub = { position: { x: 0, y: 0, z: 0 } };

  return {
    Canvas: ({ children, camera, onCreated }) => {
      if (onCreated) {
        onCreated({ gl: {}, scene: {}, camera: {} });
      }
      return (
        <div data-testid="canvas" data-camera={JSON.stringify(camera)}>
          {typeof children === "function" ? children() : children}
        </div>
      );
    },
    useThree: (selector) => selector({ controls: controlsStub, camera: cameraStub }),
    useFrame: (cb) => cb?.({ camera: cameraStub }, 0),
  };
});

vi.mock("@react-three/drei", () => ({
  OrbitControls: ({ minDistance, maxDistance }) => (
    <div
      data-testid="orbit-controls"
      data-min-distance={minDistance}
      data-max-distance={maxDistance}
    />
  ),
}));

vi.mock("../../../src/components/kinship/scene/modes/PhylogenyScene", () => ({
  __esModule: true,
  default: PhylogenySceneMock,
}));

vi.mock("../../../src/components/kinship/scene/modes/IncubatorScene", () => ({
  __esModule: true,
  default: IncubatorSceneMock,
}));

vi.mock("../../../src/components/kinship/scene/components/SceneClusters", () => ({
  __esModule: true,
  default: SceneClustersMock,
}));

vi.mock("../../../src/components/kinship/hooks/useKinshipCapture", () => ({
  useKinshipCapture: () => ({ handleCreated: handleCreatedMock }),
}));

describe("useKinshipModeSelection", () => {
  it("回傳正確的模式 key 與配置", () => {
    expect(selectKinshipMode({ phylogenyMode: true, incubatorMode: false })).toBe(KinshipModes.PHYLOGENY);
    expect(selectKinshipMode({ phylogenyMode: false, incubatorMode: true })).toBe(KinshipModes.INCUBATOR);
    expect(selectKinshipMode({ phylogenyMode: false, incubatorMode: false })).toBe(KinshipModes.DEFAULT);

    expect(KINSHIP_MODE_CONFIGS[KinshipModes.PHYLOGENY]).toMatchObject({
      cameraProps: { fov: 50, position: [0, 0, 32] },
      fogDensity: 0.018,
      ambientIntensity: 1.1,
      directionalIntensity: 0.75,
      orbitControls: { minDistance: 10, maxDistance: 80 },
    });
    expect(KINSHIP_MODE_CONFIGS[KinshipModes.INCUBATOR]).toMatchObject({
      cameraProps: { fov: 52, position: [0, 2.4, 24] },
      fogDensity: 0.026,
      ambientIntensity: 1.05,
      directionalIntensity: 0.5,
      orbitControls: { minDistance: 6, maxDistance: 48 },
      pointLightProps: { intensity: 1.2, position: [0, 3, 0], color: "#3fa9ff", distance: 42, decay: 2 },
    });
    expect(KINSHIP_MODE_CONFIGS[KinshipModes.DEFAULT]).toMatchObject({
      cameraProps: { fov: 55, position: [0, 1.2, 15] },
      fogDensity: 0.035,
      ambientIntensity: 0.9,
      directionalIntensity: 0.6,
      orbitControls: { minDistance: 4, maxDistance: 60 },
    });
  });
});

describe("KinshipScene 渲染", () => {
  const clusters = [{ id: "c1" }];
  const data = { id: "d1" };
  const baseProps = { imagesBase: "/imgs/", onPick: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("預設模式使用 SceneClusters 並帶入對應配置", () => {
    render(<KinshipScene {...baseProps} clusters={clusters} data={data} />);

    expect(SceneClustersMock).toHaveBeenCalledTimes(1);
    expect(PhylogenySceneMock).not.toHaveBeenCalled();
    expect(IncubatorSceneMock).not.toHaveBeenCalled();
    expect(handleCreatedMock).toHaveBeenCalled();

    expect(screen.getByTestId("canvas")).toHaveAttribute(
      "data-camera",
      JSON.stringify(KINSHIP_MODE_CONFIGS[KinshipModes.DEFAULT].cameraProps),
    );
    expect(screen.getByTestId("orbit-controls")).toHaveAttribute("data-min-distance", "4");
    expect(screen.getByTestId("orbit-controls")).toHaveAttribute("data-max-distance", "60");
    expect(document.querySelector("pointlight")).toBeNull();
  });

  it("親緣模式渲染 PhylogenyScene 並套用對應相機與距離", () => {
    render(<KinshipScene {...baseProps} clusters={clusters} data={data} phylogenyMode />);

    expect(PhylogenySceneMock).toHaveBeenCalledWith(
      expect.objectContaining({ imagesBase: "/imgs/", data, onPick: baseProps.onPick }),
      expect.anything(),
    );
    expect(SceneClustersMock).not.toHaveBeenCalled();
    expect(IncubatorSceneMock).not.toHaveBeenCalled();

    expect(screen.getByTestId("canvas")).toHaveAttribute(
      "data-camera",
      JSON.stringify(KINSHIP_MODE_CONFIGS[KinshipModes.PHYLOGENY].cameraProps),
    );
    expect(screen.getByTestId("orbit-controls")).toHaveAttribute("data-min-distance", "10");
    expect(screen.getByTestId("orbit-controls")).toHaveAttribute("data-max-distance", "80");
    expect(document.querySelector("pointlight")).toBeNull();
  });

  it("孵化室模式渲染 IncubatorScene 並帶入補光", () => {
    const { container } = render(
      <KinshipScene {...baseProps} clusters={clusters} data={data} incubatorMode />,
    );

    expect(IncubatorSceneMock).toHaveBeenCalledWith(
      expect.objectContaining({ imagesBase: "/imgs/", data, onPick: baseProps.onPick }),
      expect.anything(),
    );
    expect(SceneClustersMock).not.toHaveBeenCalled();
    expect(PhylogenySceneMock).not.toHaveBeenCalled();

    expect(screen.getByTestId("canvas")).toHaveAttribute(
      "data-camera",
      JSON.stringify(KINSHIP_MODE_CONFIGS[KinshipModes.INCUBATOR].cameraProps),
    );
    expect(screen.getByTestId("orbit-controls")).toHaveAttribute("data-min-distance", "6");
    expect(screen.getByTestId("orbit-controls")).toHaveAttribute("data-max-distance", "48");
    expect(container.querySelector("pointlight")).toHaveAttribute("intensity", "1.2");
  });
});
