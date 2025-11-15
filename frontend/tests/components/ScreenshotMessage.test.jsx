import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ScreenshotMessage from "../../src/components/ScreenshotMessage.jsx";

describe("ScreenshotMessage", () => {
  it("shows message when present", () => {
    render(<ScreenshotMessage message="準備截圖" />);
    expect(screen.getByText("準備截圖")).toBeInTheDocument();
  });

  it("renders nothing when message is empty", () => {
    const { container } = render(<ScreenshotMessage message={null} />);
    expect(container.firstChild).toBeNull();
  });
});
