import type { Atom } from '@reatom/core'
import {
  abortVar,
  atom,
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
import {
  longEdge,
  megapixels,
} from './image-engine/decodePolicy'
import { extractRawPreview } from './image-engine/formats/raw'
import type { RawDevelopResult } from './image-engine/formats/rawDevelop'
import { developRawToJpegBlob } from './image-engine/formats/rawDevelop'
import { resolveImageOrientationStyle } from './image-engine/orientation'
import {
  clearCanvasElement,
  decodeBlobToCanvas,
} from './image-engine/resizeBitmap'
import {
  DEFAULT_MAX_SIZE,
  type ImageMeta,
  isRawImageFormat,
  type RawImageFormat,
} from './image-engine/types'
import type { BitmapDecodePriority } from './models/bitmapDecodeLane'
import { acquireBitmapDecodeSlot } from './models/bitmapDecodeLane'
import type { PreviewLoadPriority } from './models/contracts'
import { canBrowserDecodeImageType } from './models/formatCapability'
import { acquireImageDecodeSlot } from './models/imageDecodeConcurrency'
import {
  resolveOrientedMetaDimensions,
  resolveSizedDecodeTarget,
  shouldUpgradeSizedImage,
} from './models/lightboxDisplayTarget'
import { acquireThumbnailSlot } from './models/thumbnailConcurrency'
import type { ImageFileInfo } from './types'

export type DisplayTargetSize = {
  width: number
  height: number
  zoom: number
}

export type ReatomImageOptions = {
  thumbnailOptions?: ThumbnailOptions
  filename?: string
  initialFileInfo?: ImageFileInfo
  readIgnoreExifOrientation?: () => boolean
  readDevelopRaw?: () => boolean
  previewLoadPriority?: Atom<PreviewLoadPriority>
  thumbnailTargetSize?: Atom<number>
  readDisplayTarget?: () => DisplayTargetSize | null
  readSizedImageActive?: () => boolean
  readBitmapDecodePriority?: () => BitmapDecodePriority
  readPreloadCount?: () => number
  readDevelopMaxDimension?: () => number | undefined
  readHeicDecodeSupported?: () => boolean | null
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

function previewLongEdge(meta: ImageMeta | null): number {
  if (!meta?.embeddedPreview) return 0
  const previewWidth = meta.embeddedPreview.width ?? 0
  const previewHeight = meta.embeddedPreview.height ?? 0
  return Math.max(previewWidth, previewHeight)
}

async function resolveSizedImageSourceBlob(
  fileBlob: Blob,
  metaState: ImageMeta,
  developRawEnabled: boolean,
  developMaxDimension: number | undefined,
  targetLongEdge: number,
  signal: AbortSignal,
): Promise<Blob> {
  if (!isRawImageMeta(metaState)) return fileBlob

  const embeddedPreview =
    metaState.embeddedPreview?.blob ??
    (await extractRawPreview(fileBlob, metaState.format).catch(() => null))
  if (!embeddedPreview) return fileBlob

  const embeddedLongEdge = previewLongEdge(metaState)
  const needsDevelopedSource =
    developRawEnabled &&
    developMaxDimension !== undefined &&
    (embeddedLongEdge <= 0 || targetLongEdge > embeddedLongEdge * 1.1)

  if (!needsDevelopedSource) return embeddedPreview

  const developed = await developRawToJpegBlob(fileBlob, {
    format: metaState.format,
    exif: metaState.exif,
    ignoreOrientation: false,
    maxDimension: developMaxDimension,
    signal,
  })

  return developed?.blob ?? embeddedPreview
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

  const thumbnailLongEdge = atom(0, `${name}.thumbnail.longEdge`)
  const sizedImageLongEdge = atom(0, `${name}.sizedImage.longEdge`)
  const sizedImageArtifact = atom<HTMLCanvasElement | null>(
    null,
    `${name}.sizedImage.artifact`,
  )

  const thumbnail = computed(async () => {
    // Dependency tracking only covers reads before the first await, so every
    // reactive input must be captured synchronously here. Otherwise a late
    // thumbnail-target upgrade (e.g. the grid getting measured after mount)
    // would never re-decode the thumbnail.
    const thumbnailTargetSize = options?.thumbnailTargetSize
    let requestedMaxSize = thumbnailTargetSize?.() ?? DEFAULT_MAX_SIZE
    const ignoreOrientation = ignoreExifOrientation()
    const filePromise = file()
    const thumbnailMetaPromise = thumbnailMeta()

    const previewLoadPriority = options?.previewLoadPriority
    if (previewLoadPriority) {
      while (peek(previewLoadPriority) === 'off') {
        await wrap(
          take(previewLoadPriority, (next) => next === 'off' && throwAbort()),
        )
      }
    }

    if (requestedMaxSize === 0 && thumbnailTargetSize) {
      requestedMaxSize = await wrap(
        take(
          thumbnailTargetSize,
          (next) => next || throwAbort(),
          'thumbnail.targetMeasured',
        ),
      )
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
        Promise.all([filePromise, thumbnailMetaPromise]),
      )
      const maxSize = Math.max(peek(thumbnailLongEdge), requestedMaxSize)
      const thumbnailOptions = {
        ...options?.thumbnailOptions,
        maxSize,
        ignoreExifOrientation: ignoreOrientation,
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
      if (maxSize > peek(thumbnailLongEdge)) {
        thumbnailLongEdge.set(maxSize)
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
        maxDimension: options?.readDevelopMaxDimension?.(),
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

    return decodeImageFromUrl(url, metaState, true)
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
    const metaState = await wrap(thumbnailMeta())
    if (isRawImageMeta(metaState)) return null

    const url = await wrap(fullImageUrl())
    if (!url) return null

    return decodeImageFromUrl(url, metaState, ignoreExifOrientation())
  }, `${name}.fullImage`).extend(withAsyncData())

  const sizedImage = computed(async () => {
    if (!options?.readDisplayTarget || !options.readSizedImageActive) {
      return null
    }

    if (!options.readSizedImageActive()) {
      const artifact = peek(sizedImageArtifact)
      if (artifact) clearCanvasElement(artifact)
      sizedImageArtifact.set(null)
      sizedImageLongEdge.set(0)
      return null
    }

    const displayTarget = options.readDisplayTarget()
    if (!displayTarget) return null

    const metaState = await wrap(thumbnailMeta())
    if (!metaState) return null

    const fileInfoState = fileInfo.data()
    const heicSupported = options.readHeicDecodeSupported?.() ?? null
    if (
      fileInfoState &&
      !canBrowserDecodeImageType(fileInfoState.type, heicSupported)
    ) {
      return null
    }

    const oriented = resolveOrientedMetaDimensions(
      metaState.width,
      metaState.height,
      metaState.exif,
    )
    const preloadCount = options.readPreloadCount?.() ?? 0
    const decodeTarget = resolveSizedDecodeTarget(
      oriented.width,
      oriented.height,
      displayTarget,
      displayTarget.zoom,
      preloadCount,
    )

    if (decodeTarget === 'original') return null

    const nextLongEdge = longEdge(decodeTarget)
    const currentLongEdge = peek(sizedImageLongEdge)
    const existingArtifact = peek(sizedImageArtifact)
    if (
      existingArtifact &&
      !shouldUpgradeSizedImage(currentLongEdge, decodeTarget)
    ) {
      return existingArtifact
    }

    const signal = abortVar.require().signal
    if (signal.aborted) throwAbort()

    const priority = options.readBitmapDecodePriority?.() ?? 'current'
    const outputMegapixels = megapixels(decodeTarget.width, decodeTarget.height)
    const releaseBitmapSlot = await wrap(
      acquireBitmapDecodeSlot(signal, priority, outputMegapixels),
    )

    try {
      const fileBlob = await wrap(file())
      const sourceBlob = await wrap(
        resolveSizedImageSourceBlob(
          fileBlob,
          metaState,
          developRawEnabled(),
          options.readDevelopMaxDimension?.(),
          nextLongEdge,
          signal,
        ),
      )

      const sourceFromRawPipeline =
        isRawImageMeta(metaState) && sourceBlob !== fileBlob

      const canvas = await wrap(
        decodeBlobToCanvas(
          sourceBlob,
          decodeTarget,
          metaState,
          ignoreExifOrientation() || sourceFromRawPipeline,
        ),
      )

      if (signal.aborted) {
        clearCanvasElement(canvas)
        throwAbort('sized image decode aborted')
      }

      const previousArtifact = peek(sizedImageArtifact)
      if (previousArtifact && previousArtifact !== canvas) {
        clearCanvasElement(previousArtifact)
      }

      sizedImageLongEdge.set(nextLongEdge)
      sizedImageArtifact.set(canvas)
      abortVar.subscribe(() => {
        clearCanvasElement(canvas)
        if (peek(sizedImageArtifact) === canvas) {
          sizedImageArtifact.set(null)
          sizedImageLongEdge.set(0)
        }
      })

      return canvas
    } finally {
      releaseBitmapSlot()
    }
  }, `${name}.sizedImage`).extend(withAsyncData())

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
    sizedImage,
    sizedImageLongEdge,
    sizedImageArtifact,
    thumbnailLongEdge,
  }))
}

export type ReatomImage = ReturnType<typeof reatomImage>
