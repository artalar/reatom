import { clearStack, context, wrap } from '@reatom/core'
import { expect, test, vi } from 'vitest'

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
  // Bytes loaded fine (naturalWidth > 0), but the eager full-size `decode()`
  // rejects — Chrome does this when the decoded frame does not fit the image
  // cache. The element must still be returned so the renderer can decode it
  // at paint size.
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
