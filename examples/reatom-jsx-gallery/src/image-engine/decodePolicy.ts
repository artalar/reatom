export const OVERSIZE_TOLERANCE = 1.5
export const SMALL_ORIGINAL_MEGAPIXELS = 4
export const MAX_DECODE_MEGAPIXELS = 24
export const PIN_BUDGET_BYTES = 96 * 1024 * 1024
export const MAX_CANVAS_AXIS = 16384
export const RESIZE_HYSTERESIS_RATIO = 1.15
export const MIN_RESIZE_SAVINGS_RATIO = 0.7

export const THUMB_BUCKETS = [
  192, 256, 384, 512, 768, 1024, 1536, 2048,
] as const

export type Size = { width: number; height: number }
export type SlotKind = 'lightbox' | 'thumbnail'
export type ObjectFitMode = 'contain' | 'cover'

export type DecodePolicyOptions = {
  slotKind: SlotKind
  objectFit: ObjectFitMode
  panelLongEdge: number
  preloadCount?: number
  zoom?: number
}

export type DecodeTarget = 'original' | Size

export function megapixels(width: number, height: number): number {
  return (width * height) / 1_000_000
}

export function rgbaBytes(width: number, height: number): number {
  return width * height * 4
}

export function longEdge(size: Size): number {
  return Math.max(size.width, size.height)
}

export function normalizeDimensionsForOrientation(
  width: number,
  height: number,
  orientation: number | undefined,
): Size {
  if (orientation !== undefined && orientation >= 5 && orientation <= 8) {
    return { width: height, height: width }
  }
  return { width, height }
}

export function quantizeThumbnailBucket(targetLongEdge: number): number {
  const rounded = Math.max(1, Math.ceil(targetLongEdge))
  for (const bucket of THUMB_BUCKETS) {
    if (rounded <= bucket) return bucket
  }
  return THUMB_BUCKETS[THUMB_BUCKETS.length - 1]
}

function fitScale(
  original: Size,
  slot: Size,
  objectFit: ObjectFitMode,
): number {
  if (objectFit === 'cover') {
    return Math.max(slot.width / original.width, slot.height / original.height)
  }
  return Math.min(slot.width / original.width, slot.height / original.height)
}

function computeNeeded(
  original: Size,
  slot: Size,
  objectFit: ObjectFitMode,
): Size {
  const scale = Math.min(fitScale(original, slot, objectFit), 1)
  return {
    width: Math.max(1, Math.round(original.width * scale)),
    height: Math.max(1, Math.round(original.height * scale)),
  }
}

function fitsPinBudget(original: Size, preloadCount: number): boolean {
  const bytes = rgbaBytes(original.width, original.height)
  return bytes * (1 + preloadCount) <= PIN_BUDGET_BYTES
}

function clampResizeTarget(
  target: Size,
  original: Size,
  panelLongEdge: number,
): Size {
  const panelLimit = Math.max(1, panelLongEdge)
  const axisLimit = MAX_CANVAS_AXIS

  let width = Math.min(target.width, original.width, panelLimit, axisLimit)
  let height = Math.min(target.height, original.height, panelLimit, axisLimit)

  const targetRatio = target.width / target.height
  if (width / height > targetRatio) {
    width = Math.max(1, Math.round(height * targetRatio))
  } else {
    height = Math.max(1, Math.round(width / targetRatio))
  }

  width = Math.min(width, original.width, panelLimit, axisLimit)
  height = Math.min(height, original.height, panelLimit, axisLimit)

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  }
}

export function snapToIdctRung(
  sourceLongEdge: number,
  targetLongEdge: number,
): number {
  const source = Math.max(1, sourceLongEdge)
  const target = Math.max(1, Math.ceil(targetLongEdge))

  const rungs = [4, 5, 6, 7, 8].map((numerator) =>
    Math.max(1, Math.round((source * numerator) / 8)),
  )

  for (const rung of rungs) {
    if (rung >= target) return rung
  }

  return source
}

function resizeTargetFromLongEdge(original: Size, rungLongEdge: number): Size {
  const sourceLong = longEdge(original)
  const scale = Math.min(1, rungLongEdge / sourceLong)
  return {
    width: Math.max(1, Math.round(original.width * scale)),
    height: Math.max(1, Math.round(original.height * scale)),
  }
}

function capMegapixels(target: Size, maxMegapixels: number): Size {
  const currentMp = megapixels(target.width, target.height)
  if (currentMp <= maxMegapixels) return target

  const scale = Math.sqrt(maxMegapixels / currentMp)
  return {
    width: Math.max(1, Math.round(target.width * scale)),
    height: Math.max(1, Math.round(target.height * scale)),
  }
}

export function resolveZoomTierTarget(
  original: Size,
  slot: Size,
  options: Pick<DecodePolicyOptions, 'panelLongEdge' | 'preloadCount' | 'zoom'>,
): DecodeTarget {
  const zoom = Math.max(1, options.zoom ?? 1)
  const preloadCount = options.preloadCount ?? 0
  const displayNeeded = computeNeeded(original, slot, 'contain')
  const displayLong = longEdge(displayNeeded)
  const originalLong = longEdge(original)

  if (displayLong >= originalLong && fitsPinBudget(original, preloadCount)) {
    return 'original'
  }

  const rungLong = snapToIdctRung(originalLong, displayLong)
  let target = resizeTargetFromLongEdge(original, rungLong)
  target = capMegapixels(target, MAX_DECODE_MEGAPIXELS)
  target = clampResizeTarget(target, original, options.panelLongEdge)

  if (
    longEdge(target) >= originalLong &&
    fitsPinBudget(original, preloadCount)
  ) {
    return 'original'
  }

  if (zoom > 1 && !fitsPinBudget(original, preloadCount)) {
    return target
  }

  return target
}

export function resolveDecodeTarget(
  original: Size,
  slot: Size,
  options: DecodePolicyOptions,
): DecodeTarget {
  const zoom = Math.max(1, options.zoom ?? 1)
  const preloadCount = options.preloadCount ?? 0
  const scale = fitScale(original, slot, options.objectFit)

  if (scale >= 1) {
    return 'original'
  }

  if (zoom > 1.001) {
    return resolveZoomTierTarget(original, slot, options)
  }

  const needed = computeNeeded(original, slot, options.objectFit)
  const neededLong = longEdge(needed)
  const originalLong = longEdge(original)
  const oversizeRatio = originalLong / neededLong

  if (
    oversizeRatio <= OVERSIZE_TOLERANCE &&
    fitsPinBudget(original, preloadCount)
  ) {
    return 'original'
  }

  if (
    options.slotKind === 'lightbox' &&
    megapixels(original.width, original.height) <= SMALL_ORIGINAL_MEGAPIXELS
  ) {
    return 'original'
  }

  const neededArea = needed.width * needed.height
  const originalArea = original.width * original.height
  if (neededArea >= originalArea * MIN_RESIZE_SAVINGS_RATIO) {
    return 'original'
  }

  const target = clampResizeTarget(needed, original, options.panelLongEdge)
  return capMegapixels(target, MAX_DECODE_MEGAPIXELS)
}

export function shouldUpgradeDecodeTarget(
  currentLongEdge: number,
  nextLongEdge: number,
): boolean {
  if (currentLongEdge <= 0) return true
  return nextLongEdge > currentLongEdge * RESIZE_HYSTERESIS_RATIO
}
