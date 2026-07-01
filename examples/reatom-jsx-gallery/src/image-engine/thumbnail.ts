import { extractExifThumbnail } from './formats/jpeg'
import { extractRawPreview } from './formats/raw'
import { parseImageMeta } from './header'
import {
  applyOrientationToImageBitmap,
  getOrientationFromExif,
} from './orientation'
import type { ImageMeta, ThumbnailOptions, ThumbnailResult } from './types'
import { DEFAULT_MAX_SIZE, DEFAULT_QUALITY } from './types'
import { isRawImageFormat } from './types'

export type ThumbnailOrientationOptions = {
  ignoreExifOrientation?: boolean
}

function createThumbnailAbortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason

  const error = new Error(String(signal.reason ?? 'thumbnail request aborted'))
  error.name = 'AbortError'
  return error
}

function throwIfThumbnailAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw createThumbnailAbortError(signal)
}

function isThumbnailAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

async function bitmapToThumbnailResult(
  bitmap: ImageBitmap,
  maxSize: number,
  quality: number,
  source: ThumbnailResult['source'],
  orientationBaked = false,
  signal?: AbortSignal,
): Promise<ThumbnailResult> {
  if (signal?.aborted) {
    bitmap.close()
    throw createThumbnailAbortError(signal)
  }

  const { width: origWidth, height: origHeight } = bitmap

  const scale = Math.min(maxSize / origWidth, maxSize / origHeight, 1)
  const width = Math.max(1, Math.round(origWidth * scale))
  const height = Math.max(1, Math.round(origHeight * scale))

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Failed to get 2D canvas context')
  }
  try {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
  } finally {
    bitmap.close()
  }

  throwIfThumbnailAborted(signal)

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
  throwIfThumbnailAborted(signal)
  const url = URL.createObjectURL(blob)

  return { url, width, height, source, orientationBaked }
}

async function generateThumbnailFromBlob(
  source: Blob,
  maxSize: number,
  quality: number,
  meta: ImageMeta | null,
  ignoreExifOrientation: boolean,
  signal?: AbortSignal,
): Promise<ThumbnailResult> {
  throwIfThumbnailAborted(signal)

  const resizeOpts: ImageBitmapOptions = { resizeQuality: 'medium' }
  if (meta && (meta.width > maxSize || meta.height > maxSize)) {
    const scale = Math.min(maxSize / meta.width, maxSize / meta.height)
    resizeOpts.resizeWidth = Math.max(1, Math.round(meta.width * scale))
    resizeOpts.resizeHeight = Math.max(1, Math.round(meta.height * scale))
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(source, resizeOpts)
  } catch (err) {
    if (isThumbnailAbortError(err)) throw err
    throw new Error(
      `Failed to decode image: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  if (signal?.aborted) {
    bitmap.close()
    throw createThumbnailAbortError(signal)
  }

  let orientationBaked = false
  if (!ignoreExifOrientation) {
    const orientation = getOrientationFromExif(meta?.exif)
    const needsTransform =
      orientation.state === 'valid' &&
      (orientation.degrees !== 0 || orientation.mirrored)
    if (needsTransform) {
      bitmap = await applyOrientationToImageBitmap(bitmap, orientation)
      if (signal?.aborted) {
        bitmap.close()
        throw createThumbnailAbortError(signal)
      }
      orientationBaked = true
    }
  }

  return bitmapToThumbnailResult(
    bitmap,
    maxSize,
    quality,
    'generated',
    orientationBaked,
    signal,
  )
}

async function tryEmbeddedJpegPreviewPath(
  previewBlob: Blob | null,
  maxSize: number,
  quality: number,
  meta: ImageMeta | null,
  ignoreExifOrientation: boolean,
  acceptSmallPreview = false,
  signal?: AbortSignal,
): Promise<ThumbnailResult | null> {
  if (!previewBlob) return null

  try {
    throwIfThumbnailAborted(signal)
    let bitmap = await createImageBitmap(previewBlob)
    if (signal?.aborted) {
      bitmap.close()
      throw createThumbnailAbortError(signal)
    }
    const { width, height } = bitmap

    const enoughSize =
      acceptSmallPreview || width >= maxSize / 2 || height >= maxSize / 2

    if (!enoughSize) {
      bitmap.close()
      return null
    }

    let orientationBaked = false
    if (!ignoreExifOrientation) {
      const orientation = getOrientationFromExif(meta?.exif)
      const needsTransform =
        orientation.state === 'valid' &&
        (orientation.degrees !== 0 || orientation.mirrored)
      if (needsTransform) {
        bitmap = await applyOrientationToImageBitmap(bitmap, orientation)
        if (signal?.aborted) {
          bitmap.close()
          throw createThumbnailAbortError(signal)
        }
        orientationBaked = true
      }
    }

    return bitmapToThumbnailResult(
      bitmap,
      maxSize,
      quality,
      'exif',
      orientationBaked,
      signal,
    )
  } catch (error) {
    if (isThumbnailAbortError(error)) throw error
    return null
  }
}

async function tryExifPath(
  source: Blob,
  maxSize: number,
  quality: number,
  meta: ImageMeta | null,
  ignoreExifOrientation: boolean,
  signal?: AbortSignal,
): Promise<ThumbnailResult | null> {
  throwIfThumbnailAborted(signal)
  const exifBlob =
    meta?.embeddedPreview?.blob ?? (await extractExifThumbnail(source))
  throwIfThumbnailAborted(signal)
  return tryEmbeddedJpegPreviewPath(
    exifBlob,
    maxSize,
    quality,
    meta,
    ignoreExifOrientation,
    false,
    signal,
  )
}

async function tryRawPreviewPath(
  source: Blob,
  maxSize: number,
  quality: number,
  meta: ImageMeta | null,
  ignoreExifOrientation: boolean,
  signal?: AbortSignal,
): Promise<ThumbnailResult | null> {
  const rawFormat = isRawImageFormat(meta?.format) ? meta.format : undefined
  throwIfThumbnailAborted(signal)
  const rawPreviewBlob =
    meta?.embeddedPreview?.blob ?? (await extractRawPreview(source, rawFormat))
  throwIfThumbnailAborted(signal)
  return tryEmbeddedJpegPreviewPath(
    rawPreviewBlob,
    maxSize,
    quality,
    meta,
    ignoreExifOrientation,
    true,
    signal,
  )
}

function isRawFormat(meta: ImageMeta | null): boolean {
  return isRawImageFormat(meta?.format)
}

export async function loadThumbnail(
  source: Blob,
  options?: ThumbnailOptions,
): Promise<ThumbnailResult> {
  throwIfThumbnailAborted(options?.signal)
  const meta = await parseImageMeta(source)
  throwIfThumbnailAborted(options?.signal)
  return loadThumbnailWithMeta(source, meta, options)
}

export async function loadThumbnailWithMeta(
  source: Blob,
  meta: ImageMeta | null,
  options?: ThumbnailOptions & ThumbnailOrientationOptions,
): Promise<ThumbnailResult> {
  const maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE
  const quality = options?.quality ?? DEFAULT_QUALITY
  const ignoreExifOrientation = options?.ignoreExifOrientation ?? false
  const signal = options?.signal

  throwIfThumbnailAborted(signal)

  if (meta?.format === 'jpeg') {
    const exifResult = await tryExifPath(
      source,
      maxSize,
      quality,
      meta,
      ignoreExifOrientation,
      signal,
    )
    if (exifResult) return exifResult
  }

  if (isRawFormat(meta)) {
    const rawPreviewResult = await tryRawPreviewPath(
      source,
      maxSize,
      quality,
      meta,
      ignoreExifOrientation,
      signal,
    )
    if (rawPreviewResult) return rawPreviewResult
    throw new Error('No embedded preview found in RAW file')
  }

  return generateThumbnailFromBlob(
    source,
    maxSize,
    quality,
    meta,
    ignoreExifOrientation,
    signal,
  )
}

export function revokeThumbnail(result: ThumbnailResult): void {
  URL.revokeObjectURL(result.url)
}
