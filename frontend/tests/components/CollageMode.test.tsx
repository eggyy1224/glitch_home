import React, { createRef } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CollageMode from "../../src/CollageMode";

const { mockUseCollageControls } = vi.hoisted(() => ({
  mockUseCollageControls: vi.fn(),
}));

vi.mock("../../src/hooks/useCollageControls", () => ({
  __esModule: true,
  useCollageControls: mockUseCollageControls,
}));

const makePiece = (overrides = {}) => ({
  key: "p1",
  col: 0,
  row: 0,
  sourceCol: 0,
  sourceRow: 0,
  delay: 0.2,
  fromX: 1,
  fromY: 2,
  fromRot: 3,
  imageId: "img-1",
  ...overrides,
});

const baseHook = {
  rootRef: createRef(),
  resizeHandleRef: createRef(),
  stageClassName: "collage-stage",
  controlsVisible: true,
  controlsEnabled: true,
  remoteSource: null,
  loading: false,
  error: null,
  imagePool: ["a", "b"],
  selectedImages: ["img-1"],
  piecesByImage: new Map(),
  imageMetrics: {},
  mixPieces: true,
  mixBoard: { rows: 2, cols: 2 },
  mixedPieces: [makePiece()],
  edgesReady: true,
  edgeStatus: "ready",
  rows: 2,
  cols: 2,
  imageCount: 1,
  totalPieces: 4,
  stageWidth: 320,
  finalStageHeight: 180,
  handleImageCountChange: vi.fn(),
  handleRowsChange: vi.fn(),
  handleColsChange: vi.fn(),
  toggleMixPieces: vi.fn(),
  handleShuffle: vi.fn(),
  handleResizePointerDown: vi.fn(),
  imageCountMax: 5,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CollageMode", () => {
  it("顯示混合拼貼資訊並觸發控制事件", () => {
    mockUseCollageControls.mockReturnValue({ ...baseHook });

    render(<CollageMode imagesBase="/imgs/" />);

    expect(screen.getByText("混合拼貼")).toBeInTheDocument();
    expect(screen.getByText("可用圖像：2")).toBeInTheDocument();
    expect(screen.getByText("邊緣配對：已啟用")).toBeInTheDocument();
    expect(screen.getByText("畫布尺寸：320 × 180")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(baseHook.toggleMixPieces).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "重新打散" }));
    expect(baseHook.handleShuffle).toHaveBeenCalledTimes(1);

    const handle = document.querySelector(".collage-resize-handle");
    expect(handle).not.toBeNull();
    if (!handle) {
      throw new Error("missing resize handle");
    }
    fireEvent.pointerDown(handle);
    expect(baseHook.handleResizePointerDown).toHaveBeenCalledTimes(1);
  });

  it("在非混合模式下渲染切片並顯示標籤", () => {
    const piecesByImage = new Map();
    piecesByImage.set("solo", [makePiece({ key: "solo-1", imageId: "solo", col: 1, row: 1 })]);

    mockUseCollageControls.mockReturnValue({
      ...baseHook,
      mixPieces: false,
      selectedImages: ["solo"],
      piecesByImage,
      rows: 2,
      cols: 2,
      mixedPieces: [],
    });

    render(<CollageMode imagesBase="/base/" />);

    expect(screen.getByText("solo")).toBeInTheDocument();
    const piece = document.querySelector(".collage-piece");
    expect(piece).toBeInTheDocument();
  });
});
