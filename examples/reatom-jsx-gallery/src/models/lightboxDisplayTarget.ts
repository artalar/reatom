import { action, atom, effect, peek, sleep, wrap } from '@reatom/core'

import {
  longEdge,
  resolveDecodeTarget,
  shouldUpgradeDecodeTarget,
} from '../image-engine/decodePolicy'
import { getOrientationFromExif } from '../image-engine/orientation'
import { lightboxZoom } from './lightboxState'
import { devicePixelRatio, panelLongEdge, viewportSize } from './viewport'

const LIGHTBOX_HORIZONTAL_CHROME = 160
const LIGHTBOX_VERTICAL_CHROME = 180
const DISPLAY_TARGET_DEBOUNCE_MS = 200

function computeLightboxFrameSize(
  imageWidth: number,
  imageHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): { width: number; height: number } {
  if (imageWidth <= 0 || imageHeight <= 0) {
    return {
      width: Math.max(1, viewportWidth),
      height: Math.max(1, viewportHeight),
    }
  }

  const ratio = imageWidth / imageHeight
  let frameWidth = viewportWidth
  let frameHeight = frameWidth / ratio

  if (frameHeight > viewportHeight) {
    frameHeight = viewportHeight
    frameWidth = frameHeight * ratio
  }

  return {
    width: Math.max(1, frameWidth),
    height: Math.max(1, frameHeight),
  }
}

export function computeDisplayTarget(
  imageWidth: number,
  imageHeight: number,
  zoom: number,
): { width: number; height: number; zoom: number } | null {
  if (imageWidth <= 0 || imageHeight <= 0) return null

  const { width: viewportWidth, height: viewportHeight } = viewportSize()
  const availableWidth = Math.max(1, viewportWidth - LIGHTBOX_HORIZONTAL_CHROME)
  const availableHeight = Math.max(1, viewportHeight - LIGHTBOX_VERTICAL_CHROME)
  const frame = computeLightboxFrameSize(
    imageWidth,
    imageHeight,
    availableWidth,
    availableHeight,
  )
  const pixelRatio = devicePixelRatio()
  const normalizedZoom = Math.max(1, zoom)

  return {
    width: Math.ceil(frame.width * pixelRatio * normalizedZoom),
    height: Math.ceil(frame.height * pixelRatio * normalizedZoom),
    zoom: normalizedZoom,
  }
}

export function resolveLightboxDisplayTargetForImage(
  imageWidth: number,
  imageHeight: number,
  isCurrent: boolean,
): ReturnType<typeof computeDisplayTarget> {
  if (isCurrent) {
    return computeDisplayTarget(imageWidth, imageHeight, lightboxZoom())
  }
  return computeDisplayTarget(imageWidth, imageHeight, 1)
}

export function resolveOrientedMetaDimensions(
  width: number,
  height: number,
  exif: Parameters<typeof getOrientationFromExif>[0],
): { width: number; height: number } {
  const orientation = getOrientationFromExif(exif)
  if (
    orientation.state === 'valid' &&
    orientation.value >= 5 &&
    orientation.value <= 8
  ) {
    return { width: height, height: width }
  }
  return { width, height }
}

export function resolveSizedDecodeTarget(
  originalWidth: number,
  originalHeight: number,
  slot: { width: number; height: number },
  zoom: number,
  preloadCount: number,
) {
  const original = { width: originalWidth, height: originalHeight }
  return resolveDecodeTarget(original, slot, {
    slotKind: 'lightbox',
    objectFit: 'contain',
    panelLongEdge: panelLongEdge(),
    preloadCount,
    zoom,
  })
}

export function shouldUpgradeSizedImage(
  currentLongEdge: number,
  nextTarget: ReturnType<typeof resolveDecodeTarget>,
): boolean {
  if (nextTarget === 'original') return true
  return shouldUpgradeDecodeTarget(currentLongEdge, longEdge(nextTarget))
}

const debouncedDisplayTarget = atom<ReturnType<typeof computeDisplayTarget>>(
  null,
  'lightbox._debouncedDisplayTarget',
)

export const lightboxDebouncedDisplayTarget = debouncedDisplayTarget

export const resetLightboxDisplayTargetDebouncer = action(() => {
  debouncedDisplayTarget.set(null)
}, 'lightbox.resetDisplayTargetDebouncer')

export function createLightboxDisplayTargetDebouncer(
  readImmediateTarget: () => ReturnType<typeof computeDisplayTarget>,
) {
  const syncDebouncedDisplayTarget = effect(async () => {
    const immediate = readImmediateTarget()
    if (peek(debouncedDisplayTarget) === null) {
      debouncedDisplayTarget.set(immediate)
    }

    await wrap(sleep(DISPLAY_TARGET_DEBOUNCE_MS))

    debouncedDisplayTarget.set(immediate)
  }, 'lightbox._syncDebouncedDisplayTarget')

  return () => syncDebouncedDisplayTarget.unsubscribe()
}

export function readDebouncedDisplayTarget(
  immediate: ReturnType<typeof computeDisplayTarget>,
) {
  return debouncedDisplayTarget() ?? immediate
}

export const lightboxDisplayPreloadCount = atom(
  0,
  'lightbox.displayPreloadCount',
)

export function setLightboxDisplayPreloadCount(count: number) {
  lightboxDisplayPreloadCount.set(count)
}
