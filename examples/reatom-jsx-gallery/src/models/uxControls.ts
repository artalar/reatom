import {
  reatomCheckbox,
  reatomRadio,
  reatomToolbar,
  reatomTooltip,
  withCompositeFocus,
} from '@reatom/ux'

import type {
  GridGap,
  ImageFit,
  SortField,
  ThemeMode,
  ThemePack,
  ViewMode,
} from '../types'
import {
  IMAGE_TYPE_OPTIONS,
  filterTypes,
  includeSubfolders,
  sortField,
} from './filters'
import {
  developRawFullSize,
  ignoreExifOrientation,
  showFileSizes,
  showImageNames,
  themeMode,
  themePack,
} from './preferences'
import {
  keepLightboxView,
  showLightboxScrubber,
  wrapFolderNavigation,
} from './lightboxState'
import { gridGap, imageFit, viewMode } from './view'

/** Accessible view-mode selector backed directly by the persisted view atom. */
export const viewModeRadio = reatomRadio<ViewMode>({
  valueAtom: viewMode,
  items: [
    { value: 'grid', text: 'Grid' },
    { value: 'list', text: 'List' },
    { value: 'table', text: 'Table' },
  ],
  orientation: 'horizontal',
  native: false,
  name: 'gallery.viewModeRadio',
})
viewModeRadio.composite.extend(withCompositeFocus({ scrollIntoView: false }))

/** Accessible sort-field selector backed by the gallery sort atom. */
export const sortFieldRadio = reatomRadio<SortField>({
  valueAtom: sortField,
  items: [
    { value: 'name', text: 'Name' },
    { value: 'size', text: 'Size' },
    { value: 'date', text: 'Date' },
    { value: 'type', text: 'Type' },
    { value: 'dimensions', text: 'Dimensions' },
  ],
  orientation: 'horizontal',
  native: false,
  name: 'gallery.sortFieldRadio',
})
sortFieldRadio.composite.extend(withCompositeFocus({ scrollIntoView: false }))

/** Accessible grid-gap selector backed by the persisted preference atom. */
export const gridGapRadio = reatomRadio<GridGap>({
  valueAtom: gridGap,
  orientation: 'horizontal',
  native: false,
  name: 'gallery.gridGapRadio',
})
gridGapRadio.composite.extend(withCompositeFocus({ scrollIntoView: false }))

/** Accessible image-fit selector backed by the persisted preference atom. */
export const imageFitRadio = reatomRadio<ImageFit>({
  valueAtom: imageFit,
  orientation: 'horizontal',
  native: false,
  name: 'gallery.imageFitRadio',
})
imageFitRadio.composite.extend(withCompositeFocus({ scrollIntoView: false }))

/** Accessible theme-pack selector backed by the theme atom. */
export const themePackRadio = reatomRadio<ThemePack>({
  valueAtom: themePack,
  orientation: 'vertical',
  native: false,
  name: 'gallery.themePackRadio',
})
themePackRadio.composite.extend(withCompositeFocus({ scrollIntoView: false }))

/** Accessible theme-mode selector backed by the theme atom. */
export const themeModeRadio = reatomRadio<ThemeMode>({
  valueAtom: themeMode,
  orientation: 'horizontal',
  native: false,
  name: 'gallery.themeModeRadio',
})
themeModeRadio.composite.extend(withCompositeFocus({ scrollIntoView: false }))

/** File-type checkbox group backed by the filter value array. */
export const filterTypeCheckboxes = reatomCheckbox<ReadonlyArray<string>>({
  valueAtom: filterTypes,
  name: 'gallery.filterTypes',
})

// Boolean controls adopt the existing atoms, so preferences and persistence
// remain the single source of truth while the UX models supply native props.
export const includeSubfoldersCheckbox = reatomCheckbox({
  valueAtom: includeSubfolders,
  name: 'gallery.includeSubfolders',
})
export const showImageNamesCheckbox = reatomCheckbox({
  valueAtom: showImageNames,
  name: 'gallery.showImageNames',
})
export const showFileSizesCheckbox = reatomCheckbox({
  valueAtom: showFileSizes,
  name: 'gallery.showFileSizes',
})
export const ignoreExifOrientationCheckbox = reatomCheckbox({
  valueAtom: ignoreExifOrientation,
  name: 'gallery.ignoreExifOrientation',
})
export const developRawFullSizeCheckbox = reatomCheckbox({
  valueAtom: developRawFullSize,
  name: 'gallery.developRawFullSize',
})
export const wrapFolderNavigationCheckbox = reatomCheckbox({
  valueAtom: wrapFolderNavigation,
  name: 'gallery.wrapFolderNavigation',
})
export const keepLightboxViewCheckbox = reatomCheckbox({
  valueAtom: keepLightboxView,
  name: 'gallery.keepLightboxView',
})
export const showLightboxScrubberCheckbox = reatomCheckbox({
  valueAtom: showLightboxScrubber,
  name: 'gallery.showLightboxScrubber',
})

/** Roving-tabindex toolbar for selection commands. */
export const selectionToolbar = reatomToolbar({
  name: 'gallery.selectionToolbar',
}).extend(withCompositeFocus({ scrollIntoView: false }))
export const selectAllToolbarItem = selectionToolbar.items.renderItem({
  id: 'gallery-selection-all',
  text: 'Select all',
})
export const clearSelectionToolbarItem = selectionToolbar.items.renderItem({
  id: 'gallery-selection-clear',
  text: 'Clear selection',
})

/** Tooltip for the icon-only theme command. */
export const themeToggleTooltip = reatomTooltip({
  name: 'gallery.themeToggleTooltip',
})

// Prime the fixed file-type item identities once, outside render computations.
for (const option of IMAGE_TYPE_OPTIONS) filterTypeCheckboxes.item(option.ext)
