import { clearStack, context } from '@reatom/core'
import { expect, test, vi } from 'vitest'

import { reatomImage } from './reatomImage'

class DecodeRejectingImage {
  decoding: ImageDecoding = 'auto'
  src = ''

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

test('fullImage treats browser decode failures as unavailable image data', async () => {
  vi.stubGlobal('Image', DecodeRejectingImage)

  await context.start(async () => {
    const source = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
      type: 'image/jpeg',
    })
    const image = reatomImage(source, 'broken-image')

    await expect(image.fullImage()).resolves.toBeNull()
  })
})
