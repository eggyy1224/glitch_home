import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CaptionMode from '../../src/CaptionMode.jsx'

describe('CaptionMode', () => {
  it('should render caption text when caption is provided', () => {
    const caption = {
      text: '測試說明文字'
    }

    render(<CaptionMode caption={caption} />)

    expect(screen.getByText('測試說明文字')).toBeInTheDocument()
  })

  it('should not render caption when caption is null', () => {
    const { container } = render(<CaptionMode caption={null} />)
    const content = container.querySelector('.caption-mode-content')
    expect(content).toBeNull()
  })

  it('should not render caption when caption text is empty', () => {
    const { container } = render(<CaptionMode caption={{ text: '' }} />)
    const content = container.querySelector('.caption-mode-content')
    expect(content).toBeNull()
  })

  it('should render container even when caption is null', () => {
    const { container } = render(<CaptionMode caption={null} />)
    expect(container.querySelector('.caption-mode-container')).toBeInTheDocument()
  })
})

