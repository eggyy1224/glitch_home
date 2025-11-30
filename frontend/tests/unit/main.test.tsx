// @ts-nocheck
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));

const AppMock = () => <div data-testid="app" />;
const AppModeProviderMock = ({ children }) => <div data-testid="app-mode-provider">{children}</div>;

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock,
}));

vi.mock("../../src/App", () => ({
  __esModule: true,
  default: AppMock,
}));

vi.mock("../../src/appMode/AppModeContext", () => ({
  __esModule: true,
  AppModeProvider: AppModeProviderMock,
}));

describe("main.tsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it("會將 App 掛載到 root 節點", async () => {
    await import("../../src/main");

    const rootEl = document.getElementById("root");
    expect(createRootMock).toHaveBeenCalledWith(rootEl);
    expect(renderMock).toHaveBeenCalledWith(
      <AppModeProviderMock>
        <AppMock />
      </AppModeProviderMock>,
    );
  });
});
