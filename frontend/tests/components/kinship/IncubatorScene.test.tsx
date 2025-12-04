import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import IncubatorScene from "../../../src/components/kinship/scene/modes/IncubatorScene";
import SceneClusters from "../../../src/components/kinship/scene/components/SceneClusters";
import ClusterFlower from "../../../src/components/kinship/scene/components/ClusterFlower";
import type { KinshipCluster, KinshipData } from "../../../src/types/kinship";

const {
  frameCallbacks,
  PhotoMock,
  buildLineageGraphMock,
  createIncubatorLayoutMock,
  createIncubatorEdgesMock,
  mockUseTexture,
} = vi.hoisted(() => {
  const frameCallbacks: Array<(state: { clock: { getElapsedTime: () => number } }) => void> = [];
  const PhotoMock = vi.fn((props: Record<string, unknown>) => (
    <div
      data-testid="photo"
      data-name={props.name as string}
      data-url={props.url as string}
      onClick={() => (props.onPick as ((name: string | number) => void) | undefined)?.(props.name as string)}
    />
  ));

  const buildLineageGraphMock = vi.fn((data: KinshipData | null) => data?.lineage_graph ?? { nodes: [], edges: [] });
  const createIncubatorLayoutMock = vi.fn(() => [
    { name: "root", kind: "original", baseY: 0, radius: 0, angle: 0, orbitSpeed: 0, wobbleAmp: 0, floatAmp: 0 },
    { name: "child", kind: "child", baseY: 1, radius: 2, angle: 1.2, orbitSpeed: 0, wobbleAmp: 0.1, floatAmp: 0.2 },
  ]);
  const createIncubatorEdgesMock = vi.fn((_, nodes) => [
    { source: nodes[0], target: nodes[1], baseOpacity: 0.7 },
  ]);
  const mockUseTexture = vi.fn(() => ({ image: { width: 2, height: 1 }, wrapS: "", wrapT: "", needsUpdate: false }));

  return {
    frameCallbacks,
    PhotoMock,
    buildLineageGraphMock,
    createIncubatorLayoutMock,
    createIncubatorEdgesMock,
    mockUseTexture,
  };
});

vi.mock("@react-three/fiber", () => ({
  __esModule: true,
  Canvas: ({ children }: { children?: React.ReactNode }) => <div data-testid="canvas">{children}</div>,
  useFrame: (cb?: (state: { clock: { getElapsedTime: () => number } }) => void) => {
    if (cb) frameCallbacks.push(cb);
  },
  useThree: () => ({ clock: { getElapsedTime: () => 0 } }),
}));

vi.mock("@react-three/drei", () => ({
  __esModule: true,
  Float: ({ children }: { children?: React.ReactNode }) => <div data-testid="float">{children}</div>,
  Line: React.forwardRef((props: Record<string, unknown>, ref) => {
    if (ref && typeof ref === "object") {
      (ref as any).current = {
        geometry: { setFromPoints: () => {}, attributes: { position: { needsUpdate: false } } },
        material: { opacity: 0, transparent: false },
        visible: false,
      };
    }
    return <div data-testid="line" data-color={props.color as string} />;
  }),
  useTexture: (...args: unknown[]) => mockUseTexture(...args),
}));

vi.mock("@react-spring/three", () => ({
  __esModule: true,
  a: {
    mesh: ({ children, ...rest }: Record<string, unknown>) => <mesh data-testid="animated-mesh" {...rest}>{children}</mesh>,
    meshBasicMaterial: ({ children, ...rest }: Record<string, unknown>) => (
      <meshBasicMaterial data-testid="animated-material" {...rest}>{children}</meshBasicMaterial>
    ),
  },
  useSpring: () => [{ opacity: 0.5 }, { start: () => {}, stop: () => {} }],
}));

vi.mock("../../../src/components/kinship/scene/utils/constants", () => ({
  FLOW_TINTS: {},
  INCUBATOR_PARTICLE_COUNT: 2,
  INCUBATOR_LONG_CYCLE: 10,
}));

vi.mock("../../../src/components/kinship/scene/utils/graph", () => ({
  __esModule: true,
  buildLineageGraph: (...args: unknown[]) => buildLineageGraphMock(...(args as [KinshipData | null])),
}));

vi.mock("../../../src/components/kinship/scene/utils/layouts", () => ({
  __esModule: true,
  createIncubatorLayout: (...args: unknown[]) => createIncubatorLayoutMock(...args),
  createIncubatorEdges: (...args: unknown[]) => createIncubatorEdgesMock(...args),
}));

vi.mock("../../../src/components/kinship/scene/utils/math", () => ({
  clamp01: (value: number) => Math.min(1, Math.max(0, value)),
  easeOutCubic: (v: number) => v,
  seededRandom: () => 0.2,
}));

vi.mock("../../../src/components/kinship/scene/components/Photo", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => PhotoMock(props),
}));

beforeEach(() => {
  frameCallbacks.splice(0, frameCallbacks.length);
  vi.clearAllMocks();
});

describe("IncubatorScene", () => {
  it("渲染背景、節點與邊，並將參數傳遞給 Photo", () => {
    const data: KinshipData = {
      lineage_graph: {
        nodes: [
          { name: "root", kind: "original" },
          { name: "child", kind: "child" },
        ],
        edges: [{ source: "root", target: "child" }],
      },
    };
    const onPick = vi.fn();

    const { container } = render(<IncubatorScene imagesBase="/imgs/" data={data} onPick={onPick} />);

    const photos = screen.getAllByTestId("photo");
    const names = photos.map((node) => node.getAttribute("data-name"));
    expect(names).toEqual(expect.arrayContaining(["root", "child"]));
    const rootNode = photos.find((node) => node.getAttribute("data-name") === "root");
    expect(rootNode).toHaveAttribute("data-url", "/imgs/root");

    const edges = container.querySelectorAll('[data-testid="line"]');
    expect(edges).toHaveLength(1);
    expect(container.querySelector("mesh")).not.toBeNull();

    photos[0].click();
    expect(onPick).toHaveBeenCalledWith("root");
  });
});

describe("SceneClusters & ClusterFlower", () => {
  it("依序渲染多個 ClusterFlower 並建立家族圈層", () => {
    const clusters: KinshipCluster[] = [
      {
        id: "c1",
        anchor: { x: 0, y: 0, z: 0 },
        data: {
          original_image: "orig",
          parents: ["offspring_p1"],
          siblings: ["offspring_s1"],
          children: ["offspring_c2"],
          ancestors_by_level: [["offspring_a1", "offspring_a2"]],
        },
      },
      {
        id: "c2",
        anchor: { x: 1, y: 1, z: 1 },
        data: { original_image: "other" },
      },
    ];

    render(<SceneClusters imagesBase="/imgs/" clusters={clusters} onPick={vi.fn()} />);

    const allPhotos = screen.getAllByTestId("photo");
    expect(allPhotos.length).toBeGreaterThanOrEqual(2);
    expect(allPhotos[0]).toHaveAttribute("data-url", "/imgs/orig");
    expect(allPhotos.some((node) => node.getAttribute("data-name") === "offspring_p1")).toBe(true);
  });

  it("ClusterFlower 觸發 onPick 並使用 anchor 建立中心", () => {
    const onPick = vi.fn();
    render(
      <ClusterFlower
        imagesBase="/base/"
        onPick={onPick}
        cluster={{
          id: "c-main",
          anchor: { x: 2, y: 3, z: 4 },
          data: { original_image: "main", parents: [], siblings: [], children: [], ancestors_by_level: [] },
        }}
      />,
    );

    const nodes = screen.getAllByTestId("photo");
    expect(nodes[0]).toHaveAttribute("data-name", "main");
    expect(nodes[0]).toHaveAttribute("data-url", "/base/main");

    nodes[0].click();
    expect(onPick).toHaveBeenCalledWith("main");
  });
});
