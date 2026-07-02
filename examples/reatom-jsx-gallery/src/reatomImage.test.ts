import { atom, clearStack, context, peek, wrap } from '@reatom/core'
import { expect, test, vi } from 'vitest'

import * as imageEngine from './image-engine'
import { reatomImage } from './reatomImage'

class DecodeRejectingImage {
  decoding: HTMLImageElement['decoding'] = 'auto'
  src = ''
  // Broken file: bytes loaded, no decodable frame.
  complete = true
  naturalWidth = 0
  naturalHeight = 0

  decode(): Promise<void> {
    return Promise.reject(
      new DOMException('The source image cannot be decoded.', 'EncodingError'),
    )
  }
}

test.beforeEach(() => {
  clearStack()
})

test.afterEach(() => {
  vi.unstubAllGlobals()
})

function makeJpegBlob(): Blob {
  return new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
    type: 'image/jpeg',
  })
}

test('fullImage treats browser decode failures as unavailable image data', async () => {
  vi.stubGlobal('Image', DecodeRejectingImage)

  await context.start(async () => {
    const image = reatomImage(makeJpegBlob(), 'broken-image')

    await expect(image.fullImage()).resolves.toBeNull()
  })
})

test('full image decodes are serialized to avoid decoder cache pressure', async () => {
  // Chrome rejects `img.decode()` with EncodingError when concurrent decodes
  // overflow the image cache (large photos). This stub fails any decode that
  // overlaps with another one, so the test only passes when decodes run
  // strictly one at a time.
  let inFlightDecodes = 0
  let maxInFlightDecodes = 0

  class ConcurrencyIntolerantImage {
    decoding: HTMLImageElement['decoding'] = 'auto'
    src = ''
    naturalWidth = 100
    naturalHeight = 100
    style = {
      imageOrientation: '',
      removeProperty() {},
    }

    async decode(): Promise<void> {
      inFlightDecodes += 1
      maxInFlightDecodes = Math.max(maxInFlightDecodes, inFlightDecodes)
      const overloaded = inFlightDecodes > 1
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlightDecodes -= 1
      if (overloaded) {
        throw new DOMException(
          'The source image cannot be decoded.',
          'EncodingError',
        )
      }
    }
  }

  vi.stubGlobal('Image', ConcurrencyIntolerantImage)

  await context.start(async () => {
    const opened = reatomImage(makeJpegBlob(), 'opened-image')
    const preloaded = reatomImage(makeJpegBlob(), 'preloaded-image')

    // The lightbox decodes the opened image and the preloaded neighbor at
    // the same time.
    const [openedImage, preloadedImage] = await wrap(
      Promise.all([opened.fullImage(), preloaded.fullImage()]),
    )

    expect(maxInFlightDecodes).toBe(1)
    expect(openedImage).not.toBeNull()
    expect(preloadedImage).not.toBeNull()
  })
})

test('fullImage keeps a loaded image when full-size decode fails under cache pressure', async () => {
  class CachePressureImage {
    decoding: HTMLImageElement['decoding'] = 'auto'
    src = ''
    complete = true
    naturalWidth = 9000
    naturalHeight = 6000
    style = {
      imageOrientation: '',
      removeProperty() {},
    }

    decode(): Promise<void> {
      return Promise.reject(
        new DOMException(
          'The source image cannot be decoded.',
          'EncodingError',
        ),
      )
    }
  }

  vi.stubGlobal('Image', CachePressureImage)

  await context.start(async () => {
    const image = reatomImage(makeJpegBlob(), 'pressured-image')

    await expect(image.fullImage()).resolves.not.toBeNull()
  })
})

test('sizedImage returns null when policy chooses original decode path', async () => {
  await context.start(async () => {
    const image = reatomImage(makeJpegBlob(), 'small-image', {
      readDisplayTarget: () => ({ width: 800, height: 600, zoom: 1 }),
      readSizedImageActive: () => true,
    })

    await expect(image.sizedImage()).resolves.toBeNull()
  })
})

test('sizedImage upgrades monotonically and clears on deactivation', async () => {
  class FakeCanvas {
    width = 0
    height = 0
    tabIndex = -1
    setAttribute() {}
    style = {}
  }

  class FakeBitmapRenderer {
    transferFromImageBitmap() {}
  }

  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(
      async (
        _source: unknown,
        options?: { resizeWidth?: number; resizeHeight?: number },
      ) => ({
        width: options?.resizeWidth ?? 1200,
        height: options?.resizeHeight ?? 800,
        close() {},
      }),
    ),
  )

  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = new FakeCanvas()
      canvas.getContext = (type: string) =>
        type === 'bitmaprenderer' ? new FakeBitmapRenderer() : null
      return canvas
    },
  })

  vi.spyOn(imageEngine, 'parseImagePreviewMeta').mockResolvedValue({
    width: 6000,
    height: 4000,
    format: 'jpeg',
    isProgressive: false,
    hasExifThumbnail: false,
  })

  vi.stubGlobal('window', {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    screen: { width: 1920 },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    matchMedia: vi.fn(() => ({
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })

  await context.start(async () => {
    const active = atom(true, 'test.sizedImageActive')
    const target = atom(
      { width: 1200, height: 800, zoom: 1 },
      'test.sizedImageTarget',
    )

    const image = reatomImage(makeJpegBlob(), 'sized-image', {
      readDisplayTarget: () => target(),
      readSizedImageActive: () => active(),
      readBitmapDecodePriority: () => 'current',
    })

    const firstCanvas = await wrap(image.sizedImage())
    expect(firstCanvas).toBeTruthy()

    const firstLongEdge = peek(image.sizedImageLongEdge)
    expect(firstLongEdge).toBeGreaterThan(0)

    target.set({ width: 2400, height: 1600, zoom: 2 })
    const upgradedCanvas = await wrap(image.sizedImage())
    expect(upgradedCanvas).toBeTruthy()
    expect(peek(image.sizedImageLongEdge)).toBeGreaterThanOrEqual(firstLongEdge)

    active.set(false)
    await expect(wrap(image.sizedImage())).resolves.toBeNull()
  })
})
