import { describe, expect, test, vi } from 'vitest'

import { resolveDecodeTarget } from './decodePolicy'

describe('resolveDecodeTarget red-team scenarios', () => {
  test('12 MP on MacBook 14" class slot resize-decodes instead of pinning original', () => {
    const target = resolveDecodeTarget(
      { width: 4032, height: 3024 },
      { width: 3024, height: 1964 },
      {
        slotKind: 'lightbox',
        objectFit: 'contain',
        panelLongEdge: 3024,
        preloadCount: 0,
        zoom: 1,
      },
    )
    expect(target).not.toBe('original')
  })

  test('24 MP with neighbor preload breaks pin budget on MacBook 16" class slot', () => {
    const target = resolveDecodeTarget(
      { width: 6000, height: 4000 },
      { width: 3456, height: 2234 },
      {
        slotKind: 'lightbox',
        objectFit: 'contain',
        panelLongEdge: 3456,
        preloadCount: 1,
        zoom: 1,
      },
    )
    expect(target).not.toBe('original')
  })
})

describe('viewport helpers', () => {
  test('device pixel ratio is clamped for decode sizing', async () => {
    vi.stubGlobal('window', {
      innerWidth: 1920,
      innerHeight: 1080,
      devicePixelRatio: 4,
      screen: { width: 1920 },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      matchMedia: vi.fn(() => ({
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })

    const { devicePixelRatio } = await import('../models/viewport')
    expect(devicePixelRatio()).toBe(3)
  })
})
