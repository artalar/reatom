import type { Atom } from '@reatom/core'
import {
  abortVar,
  computed,
  peek,
  take,
  throwAbort,
  withAsyncData,
  wrap,
} from '@reatom/core'

import type { ThumbnailOptions, ThumbnailResult } from './image-engine'
import {
  loadThumbnailWithMeta,
  parseImageMeta,
  parseImagePreviewMeta,
  revokeThumbnail,
} from './image-engine'
import { extractRawPreview } from './image-engine/formats/raw'
import type { RawDevelopResult } from './image-engine/formats/rawDevelop'
import { developRawToJpegBlob } from './image-engine/formats/rawDevelop'
import { resolveImageOrientationStyle } from './image-engine/orientation'
import {
  type ImageMeta,
  isRawImageFormat,
  type RawImageFormat,
} from './image-engine/types'
import type { PreviewLoadPriority } from './models/contracts'
import { acquireImageDecodeSlot } from './models/imageDecodeConcurrency'
import { acquireThumbnailSlot } from './models/thumbnailConcurrency'
import type { ImageFileInfo } from './types'

export type ReatomImageOptions = {
  thumbnailOptions?: ThumbnailOptions
  filename?: string
  initialFileInfo?: ImageFileInfo
  readIgnoreExifOrientation?: () => boolean
  readDevelopRaw?: () => boolean
  previewLoadPriority?: Atom<PreviewLoadPriority>
}

function isRawImageMeta(meta: ImageMeta | null): meta is ImageMeta & {
  format: RawImageFormat
} {
  return isRawImageFormat(meta?.format)
}

function getBlobFileInfo(blob: Blob, fallbackName: string): ImageFileInfo {
  if (blob instanceof File) {
    return {
      name: blob.name,
      size: blob.size,
      type: blob.type,
      lastModified: blob.lastModified,
    }
  }

  return {
    name: fallbackName,
    size: blob.size,
    type: blob.type,
    lastModified: 0,
  }
}

function isImageDecodeError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'EncodingError'
}

function waitForImageLoad(image: HTMLImageElement): Promise<boolean> {
  if (image.complete) return Promise.resolve(image.naturalWidth > 0)
  return new Promise((resolve) => {
    image.addEventListener('load', () => resolve(image.naturalWidth > 0), {
      once: true,
    })
    image.addEventListener('error', () => resolve(false), { once: true })
  })
}

async function decodeImageFromUrl(
  url: string,
  meta: ImageMeta | null,
  ignoreExifOrientation: boolean,
): Promise<HTMLImageElement | null> {
  const signal = abortVar.require().signal
  if (signal.aborted) throwAbort()

  const releaseDecodeSlot = await wrap(acquireImageDecodeSlot(signal))
  let image: HTMLImageElement | null = null
  try {
    const candidate = new Image()
    candidate.decoding = 'async'
    candidate.src = url
    try {
      await wrap(candidate.decode())
      image = candidate
    } catch (error) {
      if (signal.aborted) throwAbort('image decode aborted')
      if (!isImageDecodeError(error)) throw error
      // `decode()` rejects with EncodingError both for broken files and for
      // decoder cache pressure (e.g. another 50-megapixel frame is pinned by
      // the currently displayed photo). If the bytes loaded fine the file is
      // not broken: return the element undecoded and let the renderer decode
      // it at paint size, which succeeds where the full-size decode failed.
      image = (await wrap(waitForImageLoad(candidate))) ? candidate : null
    }
  } finally {
    releaseDecodeSlot()
  }
  if (!image) return null

  const orientationStyle = resolveImageOrientationStyle(
    meta?.exif,
    ignoreExifOrientation,
  )
  if (orientationStyle) {
    image.style.imageOrientation = orientationStyle
  }
  return image
}

export function reatomImage(
  source: FileSystemFileHandle | Blob,
  name: string,
  options?: ReatomImageOptions,
) {
  const developRawEnabled = () => options?.readDevelopRaw?.() !== false
  const ignoreExifOrientation = () =>
    options?.readIgnoreExifOrientation?.() ?? false

  const file = computed(async () => {
    if (source instanceof Blob) return source
    return await wrap(source.getFile())
  }, `${name}.file`).extend(withAsyncData())

  const fileInfo = computed(async () => {
    const blob = await wrap(file())
    return getBlobFileInfo(blob, options?.filename ?? name)
  }, `${name}.fileInfo`).extend(
    withAsyncData({ initState: options?.initialFileInfo ?? null }),
  )

  const thumbnailMeta = computed(async () => {
    const blob = await wrap(file())
    return await wrap(
      parseImagePreviewMeta(blob, { filename: options?.filename }),
    )
  }, `${name}.thumbnailMeta`).extend(withAsyncData())

  const meta = computed(async () => {
    const blob = await wrap(file())
    return await wrap(parseImageMeta(blob, { filename: options?.filename }))
  }, `${name}.meta`).extend(withAsyncData())

  const thumbnail = computed(async () => {
    const previewLoadPriority = options?.previewLoadPriority
    if (previewLoadPriority) {
      // `peek` keeps the priority out of the dependency list: priority
      // transitions must gate the start of the work, not invalidate (and
      // revoke) an already loaded thumbnail.
      while (peek(previewLoadPriority) === 'off') {
        await wrap(take(previewLoadPriority, (next) => next !== 'off'))
      }
    }

    const signal = abortVar.require().signal
    const slotPriority =
      previewLoadPriority && peek(previewLoadPriority) === 'background'
        ? 'background'
        : 'high'
    const releaseThumbnailSlot = await wrap(
      acquireThumbnailSlot(signal, slotPriority),
    )

    try {
      const [fileState, metaState] = await wrap(
        Promise.all([file(), thumbnailMeta()]),
      )
      const thumbnailOptions = {
        ...options?.thumbnailOptions,
        ignoreExifOrientation: ignoreExifOrientation(),
        signal,
      }
      const thumbnailPromise = loadThumbnailWithMeta(
        fileState,
        metaState,
        thumbnailOptions,
      )
      let thumbnailResult: ThumbnailResult
      try {
        thumbnailResult = await wrap(thumbnailPromise)
      } catch (error) {
        if (!signal.aborted) throw error

        const lateThumbnailResult = await thumbnailPromise.catch(() => null)
        if (lateThumbnailResult) revokeThumbnail(lateThumbnailResult)
        throw error
      }
      if (signal.aborted) {
        revokeThumbnail(thumbnailResult)
        throwAbort('thumbnail request aborted')
      }
      abortVar.subscribe(() => revokeThumbnail(thumbnailResult))
      return thumbnailResult
    } finally {
      releaseThumbnailSlot()
    }
  }, `${name}.thumbnail`).extend(withAsyncData())

  const embeddedPreviewUrl = computed(async () => {
    const [fileBlob, metaState] = await wrap(Promise.all([file(), meta()]))
    if (!isRawImageMeta(metaState)) return null

    const previewBlob =
      metaState.embeddedPreview?.blob ??
      (await wrap(extractRawPreview(fileBlob, metaState.format)))
    if (!previewBlob) return null

    const url = URL.createObjectURL(previewBlob)
    abortVar.subscribe(() => URL.revokeObjectURL(url))
    return url
  }, `${name}.embeddedPreviewUrl`).extend(withAsyncData())

  const rawDeveloped = computed(async (): Promise<RawDevelopResult | null> => {
    if (!developRawEnabled()) return null

    const [fileBlob, metaState] = await wrap(Promise.all([file(), meta()]))
    if (!isRawImageMeta(metaState)) return null

    return await wrap(
      developRawToJpegBlob(fileBlob, {
        format: metaState.format,
        exif: metaState.exif,
        ignoreOrientation: ignoreExifOrientation(),
        signal: abortVar.require().signal,
      }),
    )
  }, `${name}.rawDeveloped`).extend(withAsyncData())

  const developedImageUrl = computed(async () => {
    const developed = await wrap(rawDeveloped())
    if (!developed) return null
    const url = URL.createObjectURL(developed.blob)
    abortVar.subscribe(() => URL.revokeObjectURL(url))
    return url
  }, `${name}.developedImageUrl`).extend(withAsyncData())

  const rawEmbeddedPreviewImage = computed(async () => {
    const metaState = await wrap(meta())
    if (!isRawImageMeta(metaState)) return null

    const url = await wrap(embeddedPreviewUrl())
    if (!url) return null

    return decodeImageFromUrl(url, metaState, ignoreExifOrientation())
  }, `${name}.rawEmbeddedPreviewImage`).extend(withAsyncData())

  const rawDevelopedImage = computed(async () => {
    if (!developRawEnabled()) return null

    const metaState = await wrap(meta())
    if (!isRawImageMeta(metaState)) return null

    const url = await wrap(developedImageUrl())
    if (!url) return null

    return decodeImageFromUrl(url, metaState, true)
  }, `${name}.rawDevelopedImage`).extend(withAsyncData())

  const fullImageUrl = computed(async () => {
    const metaState = await wrap(thumbnailMeta())
    if (isRawImageMeta(metaState)) return null

    const blob = await wrap(file())
    const url = URL.createObjectURL(blob)
    abortVar.subscribe(() => URL.revokeObjectURL(url))
    return url
  }, `${name}.fullUrl`).extend(withAsyncData())

  const fullImage = computed(async () => {
    // Gate on the lightweight preview meta (same as `fullImageUrl`) instead of
    // the full `meta()`: the heavy EXIF parse can reject or disagree on the raw
    // format for edge-case files, which would silently leave the lightbox stuck
    // on the thumbnail. Display orientation is re-applied from `meta` at the
    // render layer, so decoding does not need the full parse to finish.
    const metaState = await wrap(thumbnailMeta())
    if (isRawImageMeta(metaState)) return null

    const url = await wrap(fullImageUrl())
    if (!url) return null

    return decodeImageFromUrl(url, metaState, ignoreExifOrientation())
  }, `${name}.fullImage`).extend(withAsyncData())

  return file.extend(() => ({
    fileInfo,
    thumbnailMeta,
    meta,
    thumbnail,
    embeddedPreviewUrl,
    rawDeveloped,
    developedImageUrl,
    rawEmbeddedPreviewImage,
    rawDevelopedImage,
    fullImageUrl,
    fullImage,
  }))
}

export type ReatomImage = ReturnType<typeof reatomImage>
