import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SubtitleOverlay from '../../src/SubtitleOverlay.jsx'

describe('SubtitleOverlay', () => {
  it('should render subtitle text when subtitle is provided', () => {
    const subtitle = {
      text: '測試字幕',
      language: 'zh-TW'
    }

    render(<SubtitleOverlay subtitle={subtitle} />)

    expect(screen.getByText('測試字幕')).toBeInTheDocument()
  })

  it('should not render when subtitle is null', () => {
    const { container } = render(<SubtitleOverlay subtitle={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('should not render when subtitle text is empty', () => {
    const { container } = render(<SubtitleOverlay subtitle={{ text: '' }} />)
    expect(container.firstChild).toBeNull()
  })

  it('should set lang attribute when language is provided', () => {
    const subtitle = {
      text: '測試字幕',
      language: 'zh-TW'
    }

    render(<SubtitleOverlay subtitle={subtitle} />)

    const element = screen.getByText('測試字幕')
    expect(element).toHaveAttribute('lang', 'zh-TW')
  })

  it('should not set lang attribute when language is not provided', () => {
    const subtitle = {
      text: '測試字幕'
    }

    render(<SubtitleOverlay subtitle={subtitle} />)

    const element = screen.getByText('測試字幕')
    expect(element).not.toHaveAttribute('lang')
  })

  it('should have proper accessibility attributes', () => {
    const subtitle = {
      text: '測試字幕',
      language: 'zh-TW'
    }

    render(<SubtitleOverlay subtitle={subtitle} />)

    const container = screen.getByRole('status')
    expect(container).toHaveAttribute('aria-live', 'polite')
  })
})

