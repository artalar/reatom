import { computed, effect } from '@reatom/core'

import { visibleImages } from './collection'
import {
  computeDisplayTarget,
  createLightboxDisplayTargetDebouncer,
  readDebouncedDisplayTarget,
  setLightboxDisplayPreloadCount,
} from './lightboxDisplayTarget'
import {
  lightboxImage,
  lightboxOpen,
  lightboxSizedImageWindowIds,
  lightboxZoom,
} from './lightboxState'

const SIZED_IMAGE_WINDOW_RADIUS = 2

export const lightboxSizedImageWindow = computed(() => {
  const current = lightboxImage()
  if (!current || !lightboxOpen()) return new Set<typeof current>()

  const images = visibleImages()
  const currentIndex = images.indexOf(current)
  if (currentIndex === -1) return new Set([current])

  const start = Math.max(0, currentIndex - SIZED_IMAGE_WINDOW_RADIUS)
  const end = Math.min(
    images.length,
    currentIndex + SIZED_IMAGE_WINDOW_RADIUS + 1,
  )

  return new Set(images.slice(start, end))
}, 'lightbox.sizedImageWindow')

const syncSizedImageWindowIds = effect(() => {
  const window = lightboxSizedImageWindow()
  lightboxSizedImageWindowIds.set(new Set([...window].map((image) => image.id)))
  setLightboxDisplayPreloadCount(Math.max(0, window.size - 1))
}, 'lightbox._syncSizedImageWindowIds')

export const bindLightboxSizedImageWindowSync = () => {
  return () => syncSizedImageWindowIds.unsubscribe()
}

export const lightboxFitDisplayTarget = computed(() => {
  const model = lightboxImage()
  if (!model) return null
  return computeDisplayTarget(model.width(), model.height(), 1)
}, 'lightbox.fitDisplayTarget')

const lightboxImmediateDisplayTarget = computed(() => {
  const model = lightboxImage()
  if (!model) return null
  return computeDisplayTarget(model.width(), model.height(), lightboxZoom())
}, 'lightbox._immediateDisplayTarget')

export const lightboxDisplayTarget = computed(() => {
  const immediate = lightboxImmediateDisplayTarget()
  return readDebouncedDisplayTarget(immediate)
}, 'lightbox.displayTarget')

export const bindLightboxDisplayTargetDebouncer = () => {
  return createLightboxDisplayTargetDebouncer(() =>
    lightboxImmediateDisplayTarget(),
  )
}

export {
  computeDisplayTarget,
  resetLightboxDisplayTargetDebouncer,
  resolveLightboxDisplayTargetForImage,
  resolveOrientedMetaDimensions,
  resolveSizedDecodeTarget,
  shouldUpgradeSizedImage,
} from './lightboxDisplayTarget'
