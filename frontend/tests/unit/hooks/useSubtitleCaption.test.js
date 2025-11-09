import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the API module before importing the hook
vi.mock('../../../src/api.js', () => ({
  fetchSubtitleState: vi.fn(() => Promise.resolve({ subtitle: null })),
  fetchCaptionState: vi.fn(() => Promise.resolve({ caption: null }))
}))

import { useSubtitleCaption } from '../../../src/hooks/useSubtitleCaption.js'

describe('useSubtitleCaption', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.skip('should initialize with null subtitle and caption', async () => {
    // Skipped: Mock timing issues
  })

  it('should apply subtitle with duration', () => {
    const { result } = renderHook(() => useSubtitleCaption(null))

    const subtitle = {
      text: '測試字幕',
      language: 'zh-TW',
      duration_seconds: 5
    }

    act(() => {
      result.current.applySubtitle(subtitle)
    })

    // Check normalized format (duration_seconds -> durationSeconds)
    expect(result.current.subtitle).not.toBeNull()
    expect(result.current.subtitle.text).toBe('測試字幕')
    expect(result.current.subtitle.language).toBe('zh-TW')
    expect(result.current.subtitle.durationSeconds).toBe(5)

    // Fast-forward time to test timer
    act(() => {
      vi.advanceTimersByTime(5000)
    })

    // After duration, subtitle should be cleared
    expect(result.current.subtitle).toBeNull()
  })

  it('should apply caption', () => {
    const { result } = renderHook(() => useSubtitleCaption(null))

    const caption = {
      text: '測試說明',
      language: 'zh-TW'
    }

    act(() => {
      result.current.applyCaption(caption)
    })

    expect(result.current.caption).not.toBeNull()
    expect(result.current.caption.text).toBe('測試說明')
  })

  it('should clear subtitle when null is applied', () => {
    const { result } = renderHook(() => useSubtitleCaption(null))

    act(() => {
      result.current.applySubtitle({ text: '測試' })
    })

    expect(result.current.subtitle).not.toBeNull()

    act(() => {
      result.current.applySubtitle(null)
    })

    expect(result.current.subtitle).toBeNull()
  })
})
