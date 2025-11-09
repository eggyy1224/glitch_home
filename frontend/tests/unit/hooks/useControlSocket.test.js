import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useControlSocket } from '../../src/hooks/useControlSocket.js'

// Mock WebSocket
global.WebSocket = vi.fn()

describe('useControlSocket', () => {
  let mockSocket
  let socketCallbacks

  beforeEach(() => {
    vi.clearAllMocks()
    socketCallbacks = {}

    mockSocket = {
      send: vi.fn(),
      close: vi.fn(),
      addEventListener: vi.fn((event, callback) => {
        socketCallbacks[event] = callback
      }),
      removeEventListener: vi.fn(),
      readyState: WebSocket.CONNECTING
    }

    global.WebSocket.mockImplementation(() => mockSocket)
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

  it('should send hello message with clientId on connection', () => {
    renderHook(() => useControlSocket({ clientId: 'test_client' }))

    // Simulate connection
    if (socketCallbacks.open) {
      socketCallbacks.open()
    }

    // Should send hello message
    expect(mockSocket.send).toHaveBeenCalled()
    const sentData = JSON.parse(mockSocket.send.mock.calls[0][0])
    expect(sentData.type).toBe('hello')
    expect(sentData.client_id).toBe('test_client')
  })

  it('should handle screenshot_request message', () => {
    const onScreenshotRequest = vi.fn()

    renderHook(() => useControlSocket({ clientId: 'test', onScreenshotRequest }))

    const message = {
      type: 'screenshot_request',
      id: 'req_123'
    }

    if (socketCallbacks.message) {
      socketCallbacks.message({ data: JSON.stringify(message) })
    }

    expect(onScreenshotRequest).toHaveBeenCalledWith(message)
  })

  it('should handle subtitle_update message', () => {
    const onSubtitleUpdate = vi.fn()

    renderHook(() => useControlSocket({ clientId: 'test', onSubtitleUpdate }))

    const message = {
      type: 'subtitle_update',
      subtitle: { text: '測試' }
    }

    if (socketCallbacks.message) {
      socketCallbacks.message({ data: JSON.stringify(message) })
    }

    expect(onSubtitleUpdate).toHaveBeenCalledWith(message)
  })

  it('should handle caption_update message', () => {
    const onCaptionUpdate = vi.fn()

    renderHook(() => useControlSocket({ clientId: 'test', onCaptionUpdate }))

    const message = {
      type: 'caption_update',
      caption: { text: '測試說明' }
    }

    if (socketCallbacks.message) {
      socketCallbacks.message({ data: JSON.stringify(message) })
    }

    expect(onCaptionUpdate).toHaveBeenCalledWith(message)
  })

  it('should handle collage_config message', () => {
    const onCollageConfig = vi.fn()

    renderHook(() => useControlSocket({ clientId: 'test', onCollageConfig }))

    const message = {
      type: 'collage_config',
      config: { images: ['img1.png'], rows: 10, cols: 10 }
    }

    if (socketCallbacks.message) {
      socketCallbacks.message({ data: JSON.stringify(message) })
    }

    expect(onCollageConfig).toHaveBeenCalledWith(message)
  })
})

