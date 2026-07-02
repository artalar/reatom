import {
  action,
  atom,
  computed,
  reatomEnum,
  withLocalStorage,
} from '@reatom/core'

import { quantizeThumbnailBucket } from '../image-engine/decodePolicy'
import { type GridGap, VIEW_MODES, type ViewMode } from '../types'
import { imageGrid } from './gridLayout'
import { devicePixelRatio } from './viewport'

const normalizeViewMode = (snapshot: unknown): ViewMode => {
  switch (snapshot) {
    case 'grid':
    case 'list':
    case 'table':
      return snapshot
    default:
      return 'grid'
  }
}

export const viewMode = reatomEnum(VIEW_MODES, 'viewMode').extend(
  withLocalStorage({
    key: 'gallery.viewMode',
    fromSnapshot: normalizeViewMode,
  }),
)

export const gridColumns = atom(4, 'gridColumns').extend(
  withLocalStorage('gallery.gridColumns'),
)

export const decreaseGridColumns = action(
  () => gridColumns.set((columns) => Math.max(columns - 1, 0)),
  'view.decreaseGridColumns',
)

export const increaseGridColumns = action(
  () => gridColumns.set((columns) => Math.min(columns + 1, 100)),
  'view.increaseGridColumns',
)

const gridColumnPresets = [0, 2, 3, 4, 6, 8, 12]

export const cycleGridColumnPreset = action(() => {
  const currentIndex = gridColumnPresets.indexOf(gridColumns())
  const nextIndex = (currentIndex + 1) % gridColumnPresets.length
  gridColumns.set(gridColumnPresets[nextIndex] ?? gridColumnPresets[0])
}, 'view.cycleGridColumnPreset')

const LIST_PREVIEW_WIDTH = {
  default: 82,
  min: 58,
  max: 154,
  step: 12,
}

const TABLE_PREVIEW_WIDTH = {
  default: 64,
  min: 48,
  max: 112,
  step: 8,
}

const LIST_PREVIEW_ASPECT_RATIO = 58 / 82
const TABLE_PREVIEW_ASPECT_RATIO = 44 / 64

const clampPreviewWidth = (
  width: number,
  range: { min: number; max: number },
): number => Math.min(Math.max(width, range.min), range.max)

export const listPreviewWidth = atom(
  LIST_PREVIEW_WIDTH.default,
  'listPreviewWidth',
)

export const listPreviewHeight = computed(
  () => Math.round(listPreviewWidth() * LIST_PREVIEW_ASPECT_RATIO),
  'listPreviewHeight',
)

export const tablePreviewWidth = atom(
  TABLE_PREVIEW_WIDTH.default,
  'tablePreviewWidth',
)

export const tablePreviewHeight = computed(
  () => Math.round(tablePreviewWidth() * TABLE_PREVIEW_ASPECT_RATIO),
  'tablePreviewHeight',
)

export const imageFit = reatomEnum(['contain', 'cover', 'fill', 'none'], {
  name: 'imageFit',
  initState: 'cover',
}).extend(withLocalStorage('gallery.imageFit'))

export const gridGap = reatomEnum(['none', 'small', 'medium', 'large', 'xl'], {
  name: 'gridGap',
  initState: 'medium',
}).extend(withLocalStorage('gallery.gridGap'))

export const setGridGap = action((gap: GridGap) => {
  gridGap.set(gap)
  if (gap === 'none') imageFit.setCover()
}, 'view.setGridGap')

export const gridColumnsLabel = computed(() => {
  const columns = gridColumns()
  return columns === 0 ? 'auto' : String(columns)
}, 'view.grid.columnsLabel')

export const decreaseImagePreviewSize = action(() => {
  const mode = viewMode()

  if (mode === 'list') {
    listPreviewWidth.set((width) =>
      clampPreviewWidth(width - LIST_PREVIEW_WIDTH.step, LIST_PREVIEW_WIDTH),
    )
    return
  }

  if (mode === 'table') {
    tablePreviewWidth.set((width) =>
      clampPreviewWidth(width - TABLE_PREVIEW_WIDTH.step, TABLE_PREVIEW_WIDTH),
    )
  }
}, 'decreaseImagePreviewSize')

export const activeThumbnailTarget = computed(() => {
  const mode = viewMode()
  const pixelRatio = devicePixelRatio()

  if (mode === 'grid') {
    return imageGrid.thumbnailTarget()
  }

  if (mode === 'list') {
    return quantizeThumbnailBucket(Math.ceil(listPreviewWidth() * pixelRatio))
  }

  return quantizeThumbnailBucket(Math.ceil(tablePreviewWidth() * pixelRatio))
}, 'view.activeThumbnailTarget')

export const increaseImagePreviewSize = action(() => {
  const mode = viewMode()

  if (mode === 'list') {
    listPreviewWidth.set((width) =>
      clampPreviewWidth(width + LIST_PREVIEW_WIDTH.step, LIST_PREVIEW_WIDTH),
    )
    return
  }

  if (mode === 'table') {
    tablePreviewWidth.set((width) =>
      clampPreviewWidth(width + TABLE_PREVIEW_WIDTH.step, TABLE_PREVIEW_WIDTH),
    )
  }
}, 'increaseImagePreviewSize')
