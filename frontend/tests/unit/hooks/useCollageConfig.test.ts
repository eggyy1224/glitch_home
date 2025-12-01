import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCollageConfig } from "../../../src/hooks/useCollageConfig";

// Mock fetch
global.fetch = vi.fn();

const fetchMock = global.fetch as unknown as Mock<[input: RequestInfo | URL, init?: RequestInit | undefined], Promise<Response>>;

describe("useCollageConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return null config when collageMode is false", () => {
    const { result } = renderHook(() =>
      useCollageConfig({ collageMode: false, clientId: null })
    );

    expect(result.current.remoteConfig).toBeNull();
    expect(result.current.controlsEnabled).toBe(true);
  });

  it("should load config when collageMode is true", async () => {
    const mockConfig = {
      config: {
        images: ["img1.png"],
        rows: 10,
        cols: 10,
      },
      source: "global",
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockConfig,
    });

    const { result } = renderHook(() =>
      useCollageConfig({ collageMode: true, clientId: null })
    );

    await waitFor(() => {
      expect(result.current.remoteConfig).not.toBeNull();
    });

    // sanitizeCollageConfig adds default values, so check key fields
    expect(result.current.remoteConfig?.images).toEqual(["img1.png"]);
    expect(result.current.remoteConfig?.rows).toBe(10);
    expect(result.current.remoteConfig?.cols).toBe(10);
    expect(result.current.remoteSource).toBe("global");
  });

  it("should include clientId in request when provided", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ config: {}, source: "client" }),
    });

    renderHook(() =>
      useCollageConfig({ collageMode: true, clientId: 'test_client' })
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('client=test_client'),
      expect.anything()
    )
  })

  it("should handle fetch errors", async () => {
    fetchMock.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() =>
      useCollageConfig({ collageMode: true, clientId: null })
    );

    await waitFor(() => {
      expect(result.current.collageConfigError).toBeTruthy();
    });

    expect(result.current.remoteConfig).toBeNull();
  });

  it("should apply remote config via applyRemoteConfig", async () => {
    // Mock fetch to avoid actual API call
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ config: {}, source: "global" }),
    });

    const { result } = renderHook(() =>
      useCollageConfig({ collageMode: true, clientId: null })
    );

    // Wait for initial load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const remotePayload = {
      config: { images: ["img1.png"], rows: 5, cols: 5 },
      source: "client",
    };

    act(() => {
      result.current.applyRemoteConfig(remotePayload);
    });

    // Check that config is applied (may have additional default fields)
    await waitFor(() => {
      expect(result.current.remoteConfig).not.toBeNull();
    });

    expect(result.current.remoteConfig?.images).toEqual(["img1.png"]);
    expect(result.current.remoteConfig?.rows).toBe(5);
    expect(result.current.remoteConfig?.cols).toBe(5);
    expect(result.current.remoteSource).toBe("client");
  });
});
