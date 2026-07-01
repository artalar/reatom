import { afterEach, describe, expect, test, vi } from 'vitest'

import * as orientation from './orientation'
import { loadThumbnailWithMeta, revokeThumbnail } from './thumbnail'
import type { ImageMeta } from './types'

function stubThumbnailCanvas() {
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
  vi.stubGlobal('URL', {
    createObjectURL: () => 'blob:thumbnail-test',
    revokeObjectURL: () => undefined,
  })
}

describe('loadThumbnailWithMeta generated path', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  test('bakes EXIF orientation into generated thumbnails', async () => {
    stubThumbnailCanvas()

    const bitmap = {
      width: 200,
      height: 100,
      close: () => undefined,
    }
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    )

    const applySpy = vi
      .spyOn(orientation, 'applyOrientationToImageBitmap')
      .mockImplementation(async () => ({
        width: 100,
        height: 200,
        close: () => undefined,
      }))

    const meta: ImageMeta = {
      width: 200,
      height: 100,
      format: 'webp',
      isProgressive: false,
      hasExifThumbnail: false,
      exif: { Orientation: '6' },
    }

    const result = await loadThumbnailWithMeta(new Blob(['webp']), meta)
    expect(applySpy).toHaveBeenCalledOnce()
    expect(result.source).toBe('generated')
    expect(result.orientationBaked).toBe(true)

    revokeThumbnail(result)
  })

  test('does not bake orientation when ignoreExifOrientation is true', async () => {
    stubThumbnailCanvas()

    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 200,
        height: 100,
        close: () => undefined,
      })),
    )

    const applySpy = vi.spyOn(orientation, 'applyOrientationToImageBitmap')

    const meta: ImageMeta = {
      width: 200,
      height: 100,
      format: 'bmp',
      isProgressive: false,
      hasExifThumbnail: false,
      exif: { Orientation: '6' },
    }

    const result = await loadThumbnailWithMeta(new Blob(['bmp']), meta, {
      ignoreExifOrientation: true,
    })
    expect(applySpy).not.toHaveBeenCalled()
    expect(result.orientationBaked).toBeFalsy()

    revokeThumbnail(result)
  })

  test('does not create an object URL after aborting generated thumbnails', async () => {
    const controller = new AbortController()
    const createObjectURL = vi.fn(() => 'blob:thumbnail-test')
    const close = vi.fn()

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
          controller.abort()
          return Promise.resolve(new Blob(['jpeg'], { type: 'image/jpeg' }))
        }
      },
    )
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL: () => undefined,
    })
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => ({
        width: 200,
        height: 100,
        close,
      })),
    )

    const meta: ImageMeta = {
      width: 200,
      height: 100,
      format: 'bmp',
      isProgressive: false,
      hasExifThumbnail: false,
    }

    await expect(
      loadThumbnailWithMeta(new Blob(['bmp']), meta, {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(close).toHaveBeenCalledOnce()
    expect(createObjectURL).not.toHaveBeenCalled()
  })
})
