import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));

const AppMock = () => <div data-testid="app" />;

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock,
}));

vi.mock("../../src/App.jsx", () => ({
  __esModule: true,
  default: AppMock,
}));

describe("main.jsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("會將 App 掛載到 root 節點", async () => {
    await import("../../src/main.jsx");

    const rootEl = document.getElementById("root");
    expect(createRootMock).toHaveBeenCalledWith(rootEl);
    expect(renderMock).toHaveBeenCalledWith(<AppMock />);
  });
});
