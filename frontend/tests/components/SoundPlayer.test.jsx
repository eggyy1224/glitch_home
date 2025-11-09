import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import SoundPlayer from '../../src/SoundPlayer.jsx'
import { fetchSoundFiles } from '../../src/api.js'

// Mock API
vi.mock('../../src/api.js', () => ({
  fetchSoundFiles: vi.fn()
}))

// Mock Audio
global.Audio = vi.fn().mockImplementation(() => ({
  play: vi.fn(),
  pause: vi.fn(),
  load: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  currentTime: 0,
  duration: 0,
  paused: true,
  volume: 1
}))

describe('SoundPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchSoundFiles.mockResolvedValue({
      files: [
        { filename: 'test1.mp3', url: '/api/sound-files/test1.mp3' },
        { filename: 'test2.mp3', url: '/api/sound-files/test2.mp3' }
      ]
    })
  })

  it('should render sound player component', async () => {
    render(<SoundPlayer />)

    await waitFor(() => {
      expect(screen.getByText(/sound player/i)).toBeInTheDocument()
    })
  })

  it('should load sound files on mount', async () => {
    render(<SoundPlayer />)

    await waitFor(() => {
      expect(fetchSoundFiles).toHaveBeenCalled()
    })
  })

  it('should display sound files list', async () => {
    render(<SoundPlayer />)

    await waitFor(() => {
      expect(screen.getByText('test1.mp3')).toBeInTheDocument()
    })
  })

  it('should handle play sound', async () => {
    const mockAudio = {
      play: vi.fn(),
      pause: vi.fn(),
      load: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      currentTime: 0,
      duration: 100,
      paused: true,
      volume: 1
    }

    global.Audio.mockReturnValue(mockAudio)

    render(<SoundPlayer />)

    await waitFor(() => {
      expect(screen.getByText('test1.mp3')).toBeInTheDocument()
    })

    // Note: Actual play functionality would require user interaction simulation
    // This is a basic structure test
  })
})

