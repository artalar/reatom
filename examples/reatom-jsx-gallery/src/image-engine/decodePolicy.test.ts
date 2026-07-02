import { describe, expect, test } from 'vitest'

import {
  megapixels,
  normalizeDimensionsForOrientation,
  quantizeThumbnailBucket,
  resolveDecodeTarget,
  resolveZoomTierTarget,
  shouldUpgradeDecodeTarget,
  snapToIdctRung,
} from './decodePolicy'

describe('normalizeDimensionsForOrientation', () => {
  test('swaps axes for orientations 5-8', () => {
    expect(normalizeDimensionsForOrientation(4000, 6000, 6)).toEqual({
      width: 6000,
      height: 4000,
    })
  })

  test('keeps axes for normal orientation', () => {
    expect(normalizeDimensionsForOrientation(4000, 6000, 1)).toEqual({
      width: 4000,
      height: 6000,
    })
  })
})

describe('quantizeThumbnailBucket', () => {
  test('snaps up to the next bucket', () => {
    expect(quantizeThumbnailBucket(210)).toBe(256)
    expect(quantizeThumbnailBucket(900)).toBe(1024)
    expect(quantizeThumbnailBucket(1152)).toBe(1536)
    expect(quantizeThumbnailBucket(4000)).toBe(2048)
  })
})

describe('snapToIdctRung', () => {
  test('picks the smallest n/8 rung that covers the target', () => {
    expect(snapToIdctRung(8000, 4200)).toBe(5000)
    expect(snapToIdctRung(9504, 4752)).toBe(4752)
  })
})

describe('resolveDecodeTarget', () => {
  test('returns original when the image fits the slot', () => {
    expect(
      resolveDecodeTarget(
        { width: 1600, height: 1200 },
        { width: 3840, height: 2160 },
        { slotKind: 'lightbox', objectFit: 'contain', panelLongEdge: 3840 },
      ),
    ).toBe('original')
  })

  test('returns original for <=4 MP lightbox floor', () => {
    expect(
      resolveDecodeTarget(
        { width: 2000, height: 2000 },
        { width: 800, height: 600 },
        { slotKind: 'lightbox', objectFit: 'contain', panelLongEdge: 3840 },
      ),
    ).toBe('original')
  })

  test('does not apply the small-original floor to thumbnails', () => {
    const target = resolveDecodeTarget(
      { width: 2000, height: 2000 },
      { width: 512, height: 512 },
      { slotKind: 'thumbnail', objectFit: 'cover', panelLongEdge: 3840 },
    )
    expect(target).not.toBe('original')
    if (target !== 'original') {
      expect(megapixels(target.width, target.height)).toBeLessThan(4)
    }
  })

  test('resize-decodes 24 MP on a MacBook-class slot when preload breaks pin budget', () => {
    const target = resolveDecodeTarget(
      { width: 6000, height: 4000 },
      { width: 3024, height: 1964 },
      {
        slotKind: 'lightbox',
        objectFit: 'contain',
        panelLongEdge: 3456,
        preloadCount: 1,
      },
    )
    expect(target).not.toBe('original')
  })

  test('resize-decodes 12 MP on a Retina laptop slot inside tolerance band', () => {
    const target = resolveDecodeTarget(
      { width: 4032, height: 3024 },
      { width: 1512, height: 982 },
      {
        slotKind: 'lightbox',
        objectFit: 'contain',
        panelLongEdge: 3024,
        zoom: 1,
      },
    )
    expect(target).not.toBe('original')
    if (target !== 'original') {
      expect(target.width).toBeLessThanOrEqual(4032)
      expect(target.height).toBeLessThanOrEqual(3024)
    }
  })

  test('clamps panorama resize targets to canvas axis limit', () => {
    const target = resolveDecodeTarget(
      { width: 30000, height: 4000 },
      { width: 3840, height: 2160 },
      { slotKind: 'lightbox', objectFit: 'contain', panelLongEdge: 3840 },
    )
    expect(target).not.toBe('original')
    if (target !== 'original') {
      expect(target.width).toBeLessThanOrEqual(16384)
      expect(target.height).toBeLessThanOrEqual(16384)
    }
  })
})

describe('resolveZoomTierTarget', () => {
  test('uses n/8 rungs for 40 MP zoom without jumping to original under budget pressure', () => {
    const target = resolveZoomTierTarget(
      { width: 7728, height: 5152 },
      { width: 6048, height: 4032 },
      { panelLongEdge: 3456, preloadCount: 1, zoom: 2 },
    )
    expect(target).not.toBe('original')
    if (target !== 'original') {
      expect(target.width).toBeLessThan(7728)
      expect(target.height).toBeLessThan(5152)
    }
  })
})

describe('shouldUpgradeDecodeTarget', () => {
  test('requires >15% growth before upgrading', () => {
    expect(shouldUpgradeDecodeTarget(2000, 2200)).toBe(false)
    expect(shouldUpgradeDecodeTarget(2000, 2400)).toBe(true)
  })
})
