import { atom, computed, reatomBoolean, withLocalStorage } from '@reatom/core'

import { isRawImageFormat } from '../image-engine/types'
import { formatBytes, formatDate, formatDimensions } from '../imageFormat'
import { reatomImage } from '../reatomImage'
import type { ImageFile, ImageFileInfo } from '../types'
import type { GalleryImageModel } from './contracts'
import {
  filterSizeMax,
  filterSizeMin,
  filterTypes,
  searchQuery,
} from './filters'
import { developRawFullSize, ignoreExifOrientation } from './preferences'

function matchesVisibleFilters(
  imageSource: ImageFile,
  readFileInfo: () => ImageFileInfo | null,
): boolean {
  const activeFilterTypes = filterTypes()
  const query = searchQuery().toLowerCase()
  const sizeMin = filterSizeMin()
  const sizeMax = filterSizeMax()

  if (activeFilterTypes.size > 0) {
    const dotIndex = imageSource.name.lastIndexOf('.')
    const imageExt =
      dotIndex >= 0 ? imageSource.name.slice(dotIndex + 1).toLowerCase() : ''
    const normalizedExt = imageExt === 'jpeg' ? 'jpg' : imageExt
    if (!activeFilterTypes.has(normalizedExt)) return false
  }

  if (query && !imageSource.name.toLowerCase().includes(query)) return false

  if (sizeMin > 0 || sizeMax < Infinity) {
    const fileInfo = readFileInfo()
    if (fileInfo === null) return false
    if (fileInfo.size < sizeMin || fileInfo.size > sizeMax) return false
  }

  return true
}

export function reatomGalleryImage(imageSource: ImageFile): GalleryImageModel {
  const name = `image#${imageSource.relativePath}`
  const previewLoadPriority = atom<'off' | 'high' | 'background'>(
    'off',
    `${name}.previewLoadPriority`,
  )
  const imageModel = reatomImage(imageSource.fileHandle, name, {
    filename: imageSource.name,
    initialFileInfo: imageSource.fileInfo,
    readIgnoreExifOrientation: () => ignoreExifOrientation(),
    readDevelopRaw: () => developRawFullSize(),
    previewLoadPriority,
  })
  const selected = reatomBoolean(false, `${name}.selected`)
  const favorite = reatomBoolean(false, `${name}.favorite`).extend(
    withLocalStorage(`gallery.favorite.${imageSource.relativePath}`),
  )

  const visible = computed(
    () => matchesVisibleFilters(imageSource, imageModel.fileInfo.data),
    `${name}.visible`,
  )

  const width = computed(
    () =>
      imageModel.thumbnailMeta.data()?.width ??
      imageModel.meta.data()?.width ??
      imageModel.rawDeveloped.data()?.width ??
      imageModel.fullImage.data()?.naturalWidth ??
      0,
    `${name}.width`,
  )

  const height = computed(
    () =>
      imageModel.thumbnailMeta.data()?.height ??
      imageModel.meta.data()?.height ??
      imageModel.rawDeveloped.data()?.height ??
      imageModel.fullImage.data()?.naturalHeight ??
      0,
    `${name}.height`,
  )

  const displayStage = computed(() => {
    if (imageModel.rawDevelopedImage.data()) return 'developed'
    if (imageModel.rawEmbeddedPreviewImage.data()) return 'embedded'
    return 'thumbnail'
  }, `${name}.display.stage`)

  const displaySource = computed(() => {
    const developedUrl = imageModel.developedImageUrl.data()
    if (developedUrl) return { url: developedUrl, orientationBaked: true }

    const embeddedUrl = imageModel.embeddedPreviewUrl.data()
    if (embeddedUrl) return { url: embeddedUrl, orientationBaked: false }

    return null
  }, `${name}.display.source`)

  const displayElement = computed(
    () =>
      imageModel.rawDevelopedImage.data() ??
      imageModel.rawEmbeddedPreviewImage.data() ??
      null,
    `${name}.display.element`,
  )

  const isRawPipeline = computed(
    () =>
      isRawImageFormat(
        imageModel.thumbnailMeta.data()?.format ??
          imageModel.meta.data()?.format,
      ),
    `${name}.display.isRawPipeline`,
  )

  const preloadUrl = computed(() => {
    if (isRawPipeline()) {
      return (
        imageModel.rawEmbeddedPreviewImage.data()?.src ??
        imageModel.thumbnail.data()?.url ??
        ''
      )
    }
    return (
      imageModel.fullImage.data()?.src ?? imageModel.thumbnail.data()?.url ?? ''
    )
  }, `${name}.display.preloadUrl`)

  const downloadUrl = computed(() => {
    if (isRawPipeline()) {
      return (
        imageModel.developedImageUrl.data() ??
        imageModel.embeddedPreviewUrl.data() ??
        imageModel.thumbnail.data()?.url ??
        ''
      )
    }
    return (
      imageModel.fullImageUrl.data() ?? imageModel.thumbnail.data()?.url ?? ''
    )
  }, `${name}.display.downloadUrl`)

  const sizeLabel = computed(() => {
    const fileInfo = imageModel.fileInfo.data()
    return fileInfo === null ? 'Size pending' : formatBytes(fileInfo.size)
  }, `${name}.display.sizeLabel`)

  const typeLabel = computed(() => {
    const fileInfo = imageModel.fileInfo.data()
    return fileInfo === null ? 'Type pending' : fileInfo.type || 'Unknown'
  }, `${name}.display.typeLabel`)

  const lastModifiedLabel = computed(() => {
    const fileInfo = imageModel.fileInfo.data()
    return fileInfo === null
      ? 'Modified pending'
      : formatDate(fileInfo.lastModified)
  }, `${name}.display.lastModifiedLabel`)

  const dimensionsLabel = computed(
    () => formatDimensions(width(), height(), 'Dimensions pending'),
    `${name}.display.dimensionsLabel`,
  )

  const summaryLabel = computed(
    () => `${sizeLabel()} | ${dimensionsLabel()} | ${lastModifiedLabel()}`,
    `${name}.display.summaryLabel`,
  )

  return imageModel.extend(() => ({
    id: imageSource.id,
    source: imageSource,
    selected,
    favorite,
    previewLoadPriority,
    visible,
    width,
    height,
    display: {
      stage: displayStage,
      source: displaySource,
      element: displayElement,
      preloadUrl,
      downloadUrl,
      isRawPipeline,
      sizeLabel,
      typeLabel,
      lastModifiedLabel,
      dimensionsLabel,
      summaryLabel,
    },
  }))
}

export function isGalleryImageModel(
  value: ImageFile | GalleryImageModel,
): value is GalleryImageModel {
  return (
    'id' in value &&
    'source' in value &&
    'selected' in value &&
    'favorite' in value &&
    'previewLoadPriority' in value &&
    'visible' in value &&
    'width' in value &&
    'height' in value
  )
}
