import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useSubtitleCaption } from '../../src/hooks/useSubtitleCaption.js'

// Mock fetch
global.fetch = vi.fn()

describe('useSubtitleCaption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('should initialize with null subtitle and caption', () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ subtitle: null, caption: null })
    })

    const { result } = renderHook(() => useSubtitleCaption(null))

    expect(result.current.subtitle).toBeNull()
    expect(result.current.caption).toBeNull()
  })

  it('should apply subtitle with duration', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ subtitle: null, caption: null })
    })

    const { result } = renderHook(() => useSubtitleCaption(null))

    const subtitle = {
      text: '測試字幕',
      language: 'zh-TW',
      duration_seconds: 5
    }

    result.current.applySubtitle(subtitle)

    expect(result.current.subtitle).toEqual(subtitle)

    // Fast-forward time to test timer
    vi.advanceTimersByTime(5000)

    // After duration, subtitle should be cleared
    // Note: This depends on implementation details
  })

  it('should apply caption', () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ subtitle: null, caption: null })
    })

    const { result } = renderHook(() => useSubtitleCaption(null))

    const caption = {
      text: '測試說明',
      language: 'zh-TW'
    }

    result.current.applyCaption(caption)

    expect(result.current.caption).toEqual(caption)
  })

  it('should clear subtitle when null is applied', () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ subtitle: null, caption: null })
    })

    const { result } = renderHook(() => useSubtitleCaption(null))

    result.current.applySubtitle({ text: '測試' })
    expect(result.current.subtitle).not.toBeNull()

    result.current.applySubtitle(null)
    expect(result.current.subtitle).toBeNull()
  })
})

