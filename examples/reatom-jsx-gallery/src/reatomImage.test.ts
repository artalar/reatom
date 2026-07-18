import { atom, clearStack, context, peek, wrap } from '@reatom/core'
import { expect, test, vi } from 'vitest'

import * as imageEngine from './image-engine'
import type { ThumbnailResult } from './image-engine'
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

test('thumbnail reuses larger cache on shrink and keeps old url while upgrading', async () => {
  let createCount = 0
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', {
    createObjectURL: () => {
      createCount += 1
      return `blob:thumbnail-${createCount}`
    },
    revokeObjectURL,
  })
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      width: number
      height: number
      constructor(width: number, height: number) {
        this.width = width
        this.height = height
      }
      getContext() {
        return {
          fillStyle: '',
          fillRect: () => undefined,
          drawImage: () => undefined,
        }
      }
      convertToBlob() {
        return Promise.resolve(new Blob(['jpeg'], { type: 'image/jpeg' }))
      }
    },
  )
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({
      width: 1200,
      height: 800,
      close() {},
    })),
  )
  vi.spyOn(imageEngine, 'parseImagePreviewMeta').mockResolvedValue({
    width: 1200,
    height: 800,
    format: 'jpeg',
    isProgressive: false,
    hasExifThumbnail: false,
  })

  await context.start(async () => {
    const target = atom(300, 'test.thumbnailTarget')
    const priority = atom<'off' | 'high' | 'background'>(
      'high',
      'test.previewPriority',
    )
    const image = reatomImage(makeJpegBlob(), 'thumbnail-cache', {
      thumbnailTargetSize: target,
      previewLoadPriority: priority,
    })

    const first = await wrap(image.thumbnail())
    expect(first.url).toBe('blob:thumbnail-1')
    expect(peek(image.thumbnailLongEdge)).toBe(300)

    target.set(200)
    const reused = await wrap(image.thumbnail())
    expect(reused).toBe(first)
    expect(createCount).toBe(1)
    expect(revokeObjectURL).not.toHaveBeenCalled()

    let upgradeResolve: ((result: ThumbnailResult) => void) | null = null
    const upgradePromise = new Promise<ThumbnailResult>((resolve) => {
      upgradeResolve = resolve
    })
    const loadSpy = vi
      .spyOn(imageEngine, 'loadThumbnailWithMeta')
      .mockImplementationOnce(async () => upgradePromise)

    target.set(600)
    const upgradeRead = wrap(image.thumbnail())
    await wrap(Promise.resolve())

    expect(image.thumbnail.data()?.url).toBe('blob:thumbnail-1')
    expect(revokeObjectURL).not.toHaveBeenCalled()

    upgradeResolve!({
      url: 'blob:thumbnail-2',
      width: 600,
      height: 400,
      source: 'generated',
    })
    const upgraded = await upgradeRead
    expect(upgraded.url).toBe('blob:thumbnail-2')
    expect(image.thumbnail.data()?.url).toBe('blob:thumbnail-2')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:thumbnail-1')
    expect(peek(image.thumbnailLongEdge)).toBe(600)

    loadSpy.mockRestore()
  })
})

test('thumbnail survives subscriber disconnect and is revoked on dispose', async () => {
  let createCount = 0
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', {
    createObjectURL: () => {
      createCount += 1
      return `blob:thumbnail-${createCount}`
    },
    revokeObjectURL,
  })
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      width: number
      height: number
      constructor(width: number, height: number) {
        this.width = width
        this.height = height
      }
      getContext() {
        return {
          fillStyle: '',
          fillRect: () => undefined,
          drawImage: () => undefined,
        }
      }
      convertToBlob() {
        return Promise.resolve(new Blob(['jpeg'], { type: 'image/jpeg' }))
      }
    },
  )
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => ({
      width: 1200,
      height: 800,
      close() {},
    })),
  )
  vi.spyOn(imageEngine, 'parseImagePreviewMeta').mockResolvedValue({
    width: 1200,
    height: 800,
    format: 'jpeg',
    isProgressive: false,
    hasExifThumbnail: false,
  })

  await context.start(async () => {
    const target = atom(300, 'test.thumbnailTarget')
    const priority = atom<'off' | 'high' | 'background'>(
      'high',
      'test.previewPriority',
    )
    const image = reatomImage(makeJpegBlob(), 'thumbnail-disconnect', {
      thumbnailTargetSize: target,
      previewLoadPriority: priority,
    })

    const stop = image.thumbnail.data.subscribe(() => {})
    const first = await wrap(image.thumbnail())
    expect(first.url).toBe('blob:thumbnail-1')

    stop()
    await wrap(Promise.resolve())

    expect(revokeObjectURL).not.toHaveBeenCalled()
    expect(image.thumbnail.data()?.url).toBe('blob:thumbnail-1')

    const reused = await wrap(image.thumbnail())
    expect(reused).toBe(first)
    expect(createCount).toBe(1)

    image.dispose()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:thumbnail-1')
    expect(image.thumbnail.data()).toBeUndefined()
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

  const createImageBitmapMock = vi.fn(
    async (
      _source: unknown,
      options?: { resizeWidth?: number; resizeHeight?: number },
    ) => ({
      width: options?.resizeWidth ?? 1200,
      height: options?.resizeHeight ?? 800,
      close() {},
    }),
  )
  vi.stubGlobal('createImageBitmap', createImageBitmapMock)

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
    if (!firstCanvas) throw new Error('Expected the first sized canvas')

    const firstLongEdge = peek(image.sizedImageLongEdge)
    expect(firstLongEdge).toBeGreaterThan(0)

    const decodeCount = createImageBitmapMock.mock.calls.length
    target.set({ width: 800, height: 600, zoom: 1 })
    const reusedCanvas = await wrap(image.sizedImage())
    expect(reusedCanvas).toBe(firstCanvas)
    expect(firstCanvas.width).toBeGreaterThan(0)
    expect(createImageBitmapMock).toHaveBeenCalledTimes(decodeCount)

    target.set({ width: 2400, height: 1600, zoom: 2 })
    const upgradedCanvas = await wrap(image.sizedImage())
    expect(upgradedCanvas).toBeTruthy()
    expect(peek(image.sizedImageLongEdge)).toBeGreaterThanOrEqual(firstLongEdge)

    active.set(false)
    await expect(wrap(image.sizedImage())).resolves.toBeNull()
    // clearSizedImage zeroes the previous canvas in place; lightbox must not
    // paint that wiped node from stale `.data()` (use artifact / size checks).
    expect(firstCanvas.width).toBe(0)
  })
})
