import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useControlSocket } from '../../../src/hooks/useControlSocket.js'

// Mock WebSocket
global.WebSocket = vi.fn()

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      VITE_API_BASE: ''
    }
  }
})

describe('useControlSocket', () => {
  let mockSocket
  let socketCallbacks

  beforeEach(() => {
    vi.clearAllMocks()
    socketCallbacks = {}

    mockSocket = {
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      readyState: WebSocket.CONNECTING
    }

    global.WebSocket.mockImplementation(() => {
      // Set callbacks when socket is created
      setTimeout(() => {
        if (mockSocket.onopen) {
          mockSocket.onopen()
        }
      }, 0)
      return mockSocket
    })
  })

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

  it('should skip WebSocket connection when disabled', () => {
    renderHook(() => useControlSocket({ clientId: 'test_client', enabled: false }))

    expect(global.WebSocket).not.toHaveBeenCalled()
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

  it('should close the socket when disabled after being enabled', async () => {
    const hook = renderHook(({ enabled }) =>
      useControlSocket({ clientId: 'test_toggle', enabled })
    , { initialProps: { enabled: true } })

    await waitFor(() => {
      expect(mockSocket.send).toHaveBeenCalled()
    }, { timeout: 1000 })

    hook.rerender({ enabled: false })

    await waitFor(() => {
      expect(mockSocket.close).toHaveBeenCalled()
    }, { timeout: 1000 })
  })
})
