import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useControlSocket } from "../../../src/hooks/useControlSocket";

// Mock WebSocket
const wsCtor = vi.fn() as unknown as typeof WebSocket;
Object.assign(wsCtor, {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
});
global.WebSocket = wsCtor;
const webSocketMock = global.WebSocket as unknown as vi.Mock;

// Mock import.meta.env
vi.stubGlobal("import", {
  meta: {
    env: {
      VITE_API_BASE: "",
    },
  },
});

describe("useControlSocket", () => {
  let mockSocket: {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onopen: (() => void) | null;
    onmessage: ((event: { data: string }) => void) | null;
    onclose: (() => void) | null;
    onerror: ((err: unknown) => void) | null;
    readyState: number;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSocket = {
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      readyState: WebSocket.CONNECTING,
    };

    webSocketMock.mockImplementation(() => {
      // Set callbacks when socket is created
      setTimeout(() => {
        if (mockSocket.onopen) {
          mockSocket.onopen()
        }
      }, 0)
      return mockSocket
    })
  })

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should connect to WebSocket on mount', () => {
    const handlers = {
      onScreenshotRequest: vi.fn(),
      onSoundPlay: vi.fn(),
      onSubtitleUpdate: vi.fn(),
      onCaptionUpdate: vi.fn(),
      onIframeConfig: vi.fn(),
      onCollageConfig: vi.fn()
    }

    renderHook(() => useControlSocket({ clientId: 'test_client', ...handlers }))

    expect(global.WebSocket).toHaveBeenCalled()
  })

  it('should send hello message with clientId on connection', async () => {
    renderHook(() => useControlSocket({ clientId: 'test_client' }))

    // Wait for hello message to be sent after connection
    await waitFor(() => {
      expect(mockSocket.send).toHaveBeenCalled()
    }, { timeout: 1000 })

    const sentData = JSON.parse(mockSocket.send.mock.calls[0][0])
    expect(sentData.type).toBe('hello')
    expect(sentData.client_id).toBe('test_client')
  })

  it('should handle screenshot_request message', async () => {
    const onScreenshotRequest = vi.fn()

    renderHook(() => useControlSocket({ clientId: 'test', onScreenshotRequest }))

    // Wait for socket to be ready
    await waitFor(() => {
      expect(mockSocket.onmessage).toBeDefined()
    }, { timeout: 1000 })

    const message = {
      type: 'screenshot_request',
      id: 'req_123'
    }

    act(() => {
      if (mockSocket.onmessage) {
        mockSocket.onmessage({ data: JSON.stringify(message) })
      }
    })

    expect(onScreenshotRequest).toHaveBeenCalledWith(message)
  })

  it('should handle subtitle_update message', async () => {
    const onSubtitleUpdate = vi.fn()

    renderHook(() => useControlSocket({ clientId: 'test', onSubtitleUpdate }))

    await waitFor(() => {
      expect(mockSocket.onmessage).toBeDefined()
    }, { timeout: 1000 })

    const message = {
      type: 'subtitle_update',
      subtitle: { text: '測試' }
    }

    act(() => {
      if (mockSocket.onmessage) {
        mockSocket.onmessage({ data: JSON.stringify(message) })
      }
    })

    expect(onSubtitleUpdate).toHaveBeenCalledWith(message)
  })

  it('should handle caption_update message', async () => {
    const onCaptionUpdate = vi.fn()

    renderHook(() => useControlSocket({ clientId: 'test', onCaptionUpdate }))

    await waitFor(() => {
      expect(mockSocket.onmessage).toBeDefined()
    }, { timeout: 1000 })

    const message = {
      type: 'caption_update',
      caption: { text: '測試說明' }
    }

    act(() => {
      if (mockSocket.onmessage) {
        mockSocket.onmessage({ data: JSON.stringify(message) })
      }
    })

    expect(onCaptionUpdate).toHaveBeenCalledWith(message)
  })

  it('should handle collage_config message', async () => {
    const onCollageConfig = vi.fn()

    renderHook(() => useControlSocket({ clientId: 'test', onCollageConfig }))

    await waitFor(() => {
      expect(mockSocket.onmessage).toBeDefined()
    }, { timeout: 1000 })

    const message = {
      type: 'collage_config',
      config: { images: ['img1.png'], rows: 10, cols: 10 }
    }

    act(() => {
      if (mockSocket.onmessage) {
        mockSocket.onmessage({ data: JSON.stringify(message) })
      }
    })

    expect(onCollageConfig).toHaveBeenCalledWith(message)
  })

  it.each([
    { type: 'screenshot_completed', handler: 'onScreenshotLifecycle', payload: { request_id: 'req' } },
    { type: 'screenshot_failed', handler: 'onScreenshotLifecycle', payload: { request_id: 'req', reason: 'boom' } },
    { type: 'sound_play', handler: 'onSoundPlay', payload: { filename: 'sound.mp3' } },
    { type: 'iframe_config', handler: 'onIframeConfig', payload: { config: { layout: 'grid' } } },
    { type: 'unlock_audio', handler: 'onUnlockAudio', payload: { ts: Date.now() } },
    { type: 'remote_click', handler: 'onRemoteClick', payload: { x: 1, y: 2 } },
    { type: 'video_control', handler: 'onVideoControl', payload: { action: 'pause' } },
    { type: 'timeline_control', handler: 'onTimelineControl', payload: { command: 'next' } }
  ])('handles %s messages', async ({ type, handler, payload }) => {
    const handlers = {
      onScreenshotLifecycle: vi.fn(),
      onSoundPlay: vi.fn(),
      onIframeConfig: vi.fn(),
      onUnlockAudio: vi.fn(),
      onRemoteClick: vi.fn(),
      onVideoControl: vi.fn(),
      onTimelineControl: vi.fn()
    }

    renderHook(() => useControlSocket({ clientId: 'test', ...handlers }))

    await waitFor(() => {
      expect(mockSocket.onmessage).toBeDefined()
    })

    act(() => {
      mockSocket.onmessage?.({ data: JSON.stringify({ type, ...payload }) })
    })

    expect(handlers[handler]).toHaveBeenCalledWith(expect.objectContaining(payload))
  })

  it('忽略無效 JSON 訊息', async () => {
    const onSoundPlay = vi.fn()
    renderHook(() => useControlSocket({ clientId: 'test', onSoundPlay }))

    await waitFor(() => {
      expect(mockSocket.onmessage).toBeDefined()
    })

    act(() => {
      mockSocket.onmessage?.({ data: '{invalid json' })
    })

    expect(onSoundPlay).not.toHaveBeenCalled()
  })

  it('socket 關閉後會排程重連', async () => {
    vi.useFakeTimers()
    renderHook(() => useControlSocket({ clientId: 'test' }))
    expect(global.WebSocket).toHaveBeenCalledTimes(1)

    act(() => {
      mockSocket.onclose?.()
    })

    vi.advanceTimersByTime(2000)
    expect(global.WebSocket).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('socket 發生錯誤時會關閉連線', async () => {
    renderHook(() => useControlSocket({ clientId: 'test' }))
    expect(mockSocket.close).not.toHaveBeenCalled()
    act(() => {
      mockSocket.onerror?.(new Error('boom'))
    })
    expect(mockSocket.close).toHaveBeenCalled()
  })
})
