import { action, atom, computed, effect, peek, sleep, wrap } from '@reatom/core'

import { resolveImageOrientationStyle } from '../image-engine/orientation'
import { resetLightboxDisplayTargetDebouncer } from './lightboxDisplayTarget'
import {
  lightboxImage,
  lightboxOpen,
  lightboxPanX,
  lightboxPanY,
  lightboxZoom,
} from './lightboxState'
import { imageInfoPanelOpen } from './panels'
import { ignoreExifOrientation } from './preferences'

const controlsFadeDelay = 2500

export const lightboxIsPanning = atom(false, 'lightbox.isPanning')
export const lightboxIsFullscreen = atom(false, 'lightbox.isFullscreen')
export const lightboxControlsVisible = atom(true, 'lightbox._controlsVisible')
export const lightboxControlsActivity = atom(0, 'lightbox._controlsActivity')
export const lightboxPanStartX = atom(0, 'lightbox.panStartX')
export const lightboxPanStartY = atom(0, 'lightbox.panStartY')

export const lightboxImageFrameSize = computed(() => {
  const model = lightboxImage()
  const width = model?.width() ?? 0
  const height = model?.height() ?? 0

  if (width <= 0 || height <= 0) {
    return {
      width: 'max(1px, calc(100vw - 160px))',
      height: 'max(1px, calc(100vh - 180px))',
    }
  }

  const ratio = width / height
  const viewportWidth = 'max(1px, calc(100vw - 160px))'
  const viewportHeight = 'max(1px, calc(100vh - 180px))'

  return {
    width: `min(${viewportWidth}, calc(${viewportHeight} * ${ratio}))`,
    height: `min(${viewportHeight}, calc(${viewportWidth} / ${ratio}))`,
  }
}, 'lightbox.imageFrameSize')

export const lightboxImageTransform = computed(() => {
  const zoom = lightboxZoom()
  const x = lightboxPanX()
  const y = lightboxPanY()
  return zoom === 1 && x === 0 && y === 0
    ? 'none'
    : `translate(${x}px, ${y}px) scale(${zoom})`
}, 'lightbox._imageTransform')

export const lightboxImageCursor = computed(
  () =>
    lightboxIsPanning() ? 'grabbing' : lightboxZoom() > 1 ? 'grab' : 'default',
  'lightbox.imageCursor',
)

export const lightboxFullscreenButtonLabel = computed(
  () => (lightboxIsFullscreen() ? 'Exit fullscreen' : 'Enter fullscreen'),
  'lightbox.fullscreenButtonLabel',
)

export const lightboxDetailsButtonLabel = computed(() => {
  const image = lightboxImage()
  const actionLabel = imageInfoPanelOpen() ? 'Hide' : 'Show'
  return image
    ? `${actionLabel} details for ${image.source.name}`
    : 'Image details'
}, 'lightbox.detailsButtonLabel')

export const lightboxDialogLabel = computed(() => {
  const image = lightboxImage()
  return image ? `Image preview: ${image.source.name}` : 'Image preview'
}, 'lightbox.dialogLabel')

export const lightboxFavoriteButtonLabel = computed(() => {
  const image = lightboxImage()
  if (!image) return 'Favorite'
  return image.favorite()
    ? `Remove ${image.source.name} from favorites`
    : `Add ${image.source.name} to favorites`
}, 'lightbox.favoriteButtonLabel')

export const lightboxDisplayOrientationStyle = computed(() => {
  const model = lightboxImage()
  if (!model) return undefined

  model.sizedImage.data()
  const sizedCanvas = model.sizedImageArtifact()
  const rawElement = model.rawDevelopedImage.data()
  const orientationBaked =
    (sizedCanvas !== null && sizedCanvas.width > 0 && sizedCanvas.height > 0) ||
    (rawElement !== null && rawElement === model.rawDevelopedImage.data())

  return resolveImageOrientationStyle(
    model.meta.data()?.exif,
    ignoreExifOrientation(),
    orientationBaked
      ? true
      : model.thumbnail.data()?.orientationBaked ||
          model.display.isRawPipeline(),
  )
}, 'lightbox.displayOrientationStyle')

export const bindLightboxHideControlsAfterInactivity = () => {
  const hideControls = effect(async () => {
    lightboxControlsActivity()
    lightboxControlsVisible.set(true)

    await wrap(sleep(controlsFadeDelay))

    if (!peek(lightboxIsPanning)) lightboxControlsVisible.set(false)
  }, 'lightbox._hideControlsAfterInactivity')

  return () => hideControls.unsubscribe()
}

export const resetLightboxSession = action(() => {
  lightboxIsPanning.set(false)
  lightboxIsFullscreen.set(false)
  lightboxControlsVisible.set(true)
  lightboxControlsActivity.set(0)
  lightboxPanStartX.set(0)
  lightboxPanStartY.set(0)
  resetLightboxDisplayTargetDebouncer()
}, 'lightbox.resetSession')

export const bindLightboxResetSessionOnClose = () => {
  const resetOnClose = effect(() => {
    if (!lightboxOpen()) resetLightboxSession()
  }, 'lightbox.resetSessionOnClose')

  return () => resetOnClose.unsubscribe()
}

export const lightboxShowControlsFromPointer = action(
  () => lightboxControlsActivity.set((activity) => activity + 1),
  'lightbox._showControls',
)

export const startLightboxPan = action((clientX: number, clientY: number) => {
  lightboxShowControlsFromPointer()
  if (peek(lightboxZoom) <= 1) return
  lightboxIsPanning.set(true)
  lightboxPanStartX.set(clientX - peek(lightboxPanX))
  lightboxPanStartY.set(clientY - peek(lightboxPanY))
}, 'lightbox.panStart')

export const moveLightboxPan = action((clientX: number, clientY: number) => {
  if (!peek(lightboxIsPanning)) return
  lightboxPanX.set(clientX - peek(lightboxPanStartX))
  lightboxPanY.set(clientY - peek(lightboxPanStartY))
}, 'lightbox._panMove')

export const endLightboxPan = action(() => {
  lightboxIsPanning.set(false)
  lightboxShowControlsFromPointer()
}, 'lightbox.panEnd')
