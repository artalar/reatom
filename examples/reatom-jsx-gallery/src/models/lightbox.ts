import {
  action,
  computed,
  isAbort,
  withAbort,
  withAsync,
  withMiddleware,
  wrap,
} from '@reatom/core'

import { copyImageAsJpegToClipboard } from '../copyImage'
import { downloadPreparedGalleryImage } from '../download'
import { visibleImages, visibleIndexMap } from './collection'
import type { GalleryImageModel } from './contracts'
import {
  navigateLightbox,
  primeLightboxPreload,
  resetLightboxPan,
} from './lightboxNavigation'
import {
  lightboxImage,
  lightboxNavigationDirection,
  lightboxOpen,
  lightboxZoom,
} from './lightboxState'
import { imageInfoPanelOpen } from './panels'
import { ensureGalleryImagePreviewHigh } from './previewLoad'
import { slideshowPlaying } from './slideshow'

export {
  bindLightboxDisplayTargetDebouncer,
  bindLightboxSizedImageWindowSync,
  lightboxDisplayTarget,
  lightboxFitDisplayTarget,
  lightboxSizedImageWindow,
  resetLightboxDisplayTargetDebouncer,
} from './lightboxDisplay'
export {
  lightboxPreloadImageElement,
  lightboxPreloadImageUrl,
  lightboxScrubberMax,
  lightboxScrubberValue,
  navigateLightbox,
  openLightboxAtVisibleIndex,
  resetLightboxPan,
} from './lightboxNavigation'
export {
  keepLightboxView,
  lightboxImage,
  lightboxNavigationDirection,
  lightboxOpen,
  lightboxPanX,
  lightboxPanY,
  lightboxZoom,
  showLightboxScrubber,
  wrapFolderNavigation,
} from './lightboxState'

export const lightboxZoomIn = action(
  () => lightboxZoom.set((zoom) => Math.min(zoom * 1.5, 10)),
  'lightbox.zoomIn',
)

export const lightboxZoomOut = action(
  () => lightboxZoom.set((zoom) => Math.max(zoom / 1.5, 0.1)),
  'lightbox.zoomOut',
)

export const lightboxZoomReset = action(() => {
  lightboxZoom.set(1)
  resetLightboxPan()
}, 'lightbox.zoomReset')

export const lightboxCounter = computed(() => {
  const image = lightboxImage()
  if (!image) return ''
  const map = visibleIndexMap()
  const position = map.get(image) ?? -1
  return position >= 0 ? `${position + 1} / ${map.size}` : ''
}, 'lightboxCounter')

export const thumbnailWindow = computed(() => {
  const current = lightboxImage()
  if (!current || !current.visible()) return []

  const images = visibleImages()
  const currentIndex = images.indexOf(current)
  if (currentIndex === -1) return []

  return images.slice(
    Math.max(currentIndex - 5, 0),
    Math.min(currentIndex + 6, images.length),
  )
}, 'thumbnailWindow')

export const openLightbox = action((model: GalleryImageModel) => {
  ensureGalleryImagePreviewHigh(model)
  lightboxImage.set(() => model)
  lightboxNavigationDirection.set(1)
  lightboxZoom.set(1)
  resetLightboxPan()
  lightboxOpen.label.set(`Image preview: ${model.source.name}`)
  lightboxOpen.show()
  primeLightboxPreload()
}, 'openLightbox')

const resetLightboxAfterClose = action(() => {
  lightboxZoom.set(1)
  resetLightboxPan()
  slideshowPlaying.setFalse()
  imageInfoPanelOpen.hide()
}, 'lightbox.resetAfterClose')

lightboxOpen.dismiss.extend(
  withMiddleware(() => (next, ...params) => {
    const result = next(...params)
    resetLightboxAfterClose()
    return result
  }),
)

export const closeLightbox = action(() => {
  lightboxOpen.dismiss('programmatic')
}, 'closeLightbox')

export const resetLightboxOnFolderChange = action(() => {
  closeLightbox()
  lightboxImage.set(null)
}, 'lightbox.resetOnFolderChange')

export const downloadLightboxImage = action(() => {
  const image = lightboxImage()
  if (image) downloadPreparedGalleryImage(image)
}, 'lightbox.downloadImage')

export const copyLightboxImageAsJpeg = action(async () => {
  const image = lightboxImage()
  if (!image) return

  try {
    await wrap(copyImageAsJpegToClipboard(image))
  } catch (error: unknown) {
    if (isAbort(error)) return
    console.error('Failed to copy image as JPEG:', error)
  }
}, 'lightbox.copyImageAsJpeg').extend(withAsync(), withAbort())

export const toggleLightboxImageFavorite = action(() => {
  lightboxImage()?.favorite.toggle()
}, 'lightbox.toggleFavorite')

export const handleLightboxKeyDown = action((event: KeyboardEvent) => {
  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      event.preventDefault()
      event.stopPropagation()
      navigateLightbox(-1)
      break
    case 'ArrowRight':
    case 'ArrowDown':
      event.preventDefault()
      event.stopPropagation()
      navigateLightbox(1)
      break
    case '-':
    case '_':
      event.preventDefault()
      event.stopPropagation()
      lightboxZoomOut()
      break
    case '=':
    case '+':
      event.preventDefault()
      event.stopPropagation()
      lightboxZoomIn()
      break
    case ' ':
      event.preventDefault()
      event.stopPropagation()
      slideshowPlaying.toggle()
      break
    case 'f':
    case 'F':
      event.preventDefault()
      event.stopPropagation()
      toggleLightboxImageFavorite()
      break
  }
}, 'lightbox.handleKeyDown')
