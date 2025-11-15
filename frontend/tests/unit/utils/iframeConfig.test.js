import { describe, it, expect } from 'vitest'
import {
  buildQueryFromIframeConfig,
  clampInt,
  DEFAULT_IFRAME_CONFIG,
  parseIframeConfigFromParams,
  sanitizeIframeConfig,
  sanitizePanels
} from '../../../src/utils/iframeConfig.js'

describe('iframeConfig utilities', () => {
  describe('clampInt', () => {
    it('should return fallback for non-finite values', () => {
      expect(clampInt(NaN, 10)).toBe(10)
      expect(clampInt(Infinity, 10)).toBe(10)
      expect(clampInt('invalid', 10)).toBe(10)
    })

    it('should clamp values within min/max range', () => {
      expect(clampInt(5, 10, { min: 0, max: 10 })).toBe(5)
      expect(clampInt(15, 10, { min: 0, max: 10 })).toBe(10)
      expect(clampInt(-5, 10, { min: 0, max: 10 })).toBe(0)
    })

    it('should floor decimal values', () => {
      expect(clampInt(5.7, 10)).toBe(5)
      expect(clampInt(5.2, 10)).toBe(5)
    })
  })

  describe('parseIframeConfigFromParams', () => {
    it('should parse valid iframe config from URL params', () => {
      const params = new URLSearchParams({
        iframe_layout: 'grid',
        iframe_gap: '12',
        iframe_columns: '2',
        iframe_panels: 'panel1,panel2',
        iframe_panel1: '/?test1=true',
        iframe_panel1_ratio: '1',
        iframe_panel2: '/?test2=true',
        iframe_panel2_ratio: '1.5'
      })

      const config = parseIframeConfigFromParams(params)

      expect(config).not.toBeNull()
      expect(config.layout).toBe('grid')
      expect(config.gap).toBe(12)
      expect(config.columns).toBe(2)
      expect(config.panels).toHaveLength(2)
      expect(config.panels[0].src).toBe('/?test1=true')
      expect(config.panels[1].ratio).toBe(1.5)
    })

    it('should return null for empty params', () => {
      const params = new URLSearchParams()
      expect(parseIframeConfigFromParams(params)).toBeNull()
    })

    it('should use default layout when invalid', () => {
      const params = new URLSearchParams({
        iframe_layout: 'invalid',
        iframe_1: '/?test=true'
      })

      const config = parseIframeConfigFromParams(params)
      expect(config.layout).toBe('grid') // default
    })

    it('should parse panels without iframe_panels param', () => {
      const params = new URLSearchParams({
        iframe_layout: 'grid',
        iframe_1: '/?test1=true',
        iframe_2: '/?test2=true'
      })

      const config = parseIframeConfigFromParams(params)
      expect(config.panels).toHaveLength(2)
      expect(config.panels[0].id).toBe('1')
      expect(config.panels[1].id).toBe('2')
    })
  })

  describe('sanitizeIframeConfig', () => {
    it('should sanitize valid config', () => {
      const config = {
        layout: 'horizontal',
        gap: 10,
        columns: 3,
        panels: [
          { id: 'panel1', src: '/?test=true', ratio: 1 },
          { id: 'panel2', src: '/?test2=true', ratio: 1.5 }
        ]
      }

      const sanitized = sanitizeIframeConfig(config)

      expect(sanitized.layout).toBe('horizontal')
      expect(sanitized.gap).toBe(10)
      expect(sanitized.columns).toBe(3)
      expect(sanitized.panels).toHaveLength(2)
    })

    it('should use fallback for invalid config', () => {
      const fallback = {
        layout: 'grid',
        gap: 0,
        columns: 2,
        panels: []
      }

      const sanitized = sanitizeIframeConfig(null, fallback)
      expect(sanitized.layout).toBe('grid')
      expect(sanitized.gap).toBe(0)
    })

    it('should sanitize panels array', () => {
      const config = {
        layout: 'grid',
        panels: [
          { src: '/?test=true', ratio: 1 },
          { src: '', ratio: 1 }, // Invalid - empty src
          { src: '/?test2=true', ratio: 'invalid' } // Invalid ratio
        ]
      }

      const sanitized = sanitizeIframeConfig(config)
      // Should filter out invalid panels
      expect(sanitized.panels.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle duplicate panel IDs', () => {
      const config = {
        layout: 'grid',
        panels: [
          { id: 'panel1', src: '/?test1=true' },
          { id: 'panel1', src: '/?test2=true' } // Duplicate ID
        ]
      }

    const sanitized = sanitizeIframeConfig(config)
    expect(sanitized.panels).toHaveLength(2)
    expect(sanitized.panels[0].id).toBe('panel1')
    // Second duplicate gets index-based suffix: panel1_2 (index is 1, so +1 = 2)
    expect(sanitized.panels[1].id).toBe('panel1_2')
    })

    it('should fall back to DEFAULT_IFRAME_CONFIG when none provided', () => {
      const sanitized = sanitizeIframeConfig(null)
      expect(sanitized).toEqual({ ...DEFAULT_IFRAME_CONFIG })
    })
  })

  describe('sanitizePanels', () => {
    it('should filter invalid panels and clamp spans', () => {
      const panels = [
        { id: 'p1', src: '/one', colSpan: 0, rowSpan: Infinity },
        { src: '   ', ratio: -1 },
        { id: 'p2', src: '/two', col_span: '3', row_span: '2' }
      ]

      const sanitized = sanitizePanels(panels)
      expect(sanitized).toHaveLength(2)
      expect(sanitized[0].colSpan).toBe(1)
      expect(sanitized[0].rowSpan).toBe(1)
      expect(sanitized[1].colSpan).toBe(3)
      expect(sanitized[1].rowSpan).toBe(2)
    })

    it('should return fallback panels when sanitized list is empty', () => {
      const fallback = [{ id: 'fallback', src: '/fallback' }]
      const sanitized = sanitizePanels([{ src: '' }], fallback)
      expect(sanitized).toEqual(fallback)
      expect(sanitized).not.toBe(fallback)
    })
  })

  describe('buildQueryFromIframeConfig', () => {
    it('should build query params from config', () => {
      const config = {
        layout: 'grid',
        gap: 12,
        columns: 2,
        panels: [
          { id: 'panel1', src: '/?test1=true', ratio: 1, label: 'Panel 1' },
          { id: 'panel2', src: '/?test2=true', ratio: 1.5 }
        ]
      }

      const query = buildQueryFromIframeConfig(config)

      expect(query).not.toBeNull()
      expect(query).toContainEqual(['iframe_layout', 'grid'])
      expect(query).toContainEqual(['iframe_gap', '12'])
      expect(query).toContainEqual(['iframe_columns', '2'])
      expect(query).toContainEqual(['iframe_p1', '/?test1=true'])
      expect(query).toContainEqual(['iframe_p1_label', 'Panel 1'])
      expect(query).toContainEqual(['iframe_p2_ratio', '1.5'])
    })

    it('should return null for empty config', () => {
      expect(buildQueryFromIframeConfig(null)).toBeNull()
      expect(buildQueryFromIframeConfig({})).toBeNull()
      expect(buildQueryFromIframeConfig({ panels: [] })).toBeNull()
    })

    it('should skip panels without src', () => {
      const config = {
        layout: 'grid',
        panels: [
          { id: 'panel1', src: '/?test=true' },
          { id: 'panel2' } // No src
        ]
      }

      const query = buildQueryFromIframeConfig(config)
      const panelKeys = query.filter(([key]) => key.startsWith('iframe_p'))
      // Should only have entries for panel1
      expect(panelKeys.length).toBeGreaterThan(0)
    })
  })
})

