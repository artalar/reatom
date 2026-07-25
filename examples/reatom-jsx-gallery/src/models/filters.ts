import { action, atom, computed, reatomBoolean, reatomEnum } from '@reatom/core'

export const IMAGE_TYPE_OPTIONS = [
  { ext: 'jpg', label: 'JPG' },
  { ext: 'png', label: 'PNG' },
  { ext: 'gif', label: 'GIF' },
  { ext: 'webp', label: 'WebP' },
  { ext: 'svg', label: 'SVG' },
  { ext: 'avif', label: 'AVIF' },
  { ext: 'bmp', label: 'BMP' },
  { ext: 'dng', label: 'DNG' },
  { ext: 'arw', label: 'ARW' },
  { ext: 'cr2', label: 'CR2' },
  { ext: 'nef', label: 'NEF' },
  { ext: 'orf', label: 'ORF' },
  { ext: 'sr2', label: 'SR2' },
] as const

export const sortField = reatomEnum(
  ['name', 'size', 'date', 'type', 'dimensions'],
  'sortField',
)

export const sortOrder = reatomEnum(['asc', 'desc'], 'sortOrder')

export const filterTypes = atom<ReadonlyArray<string>>([], 'filterTypes')
export const searchQuery = atom('', 'searchQuery')
export const includeSubfolders = reatomBoolean(true, 'includeSubfolders')
export const filterSizeMin = atom(0, 'filterSizeMin')
export const filterSizeMax = atom(Infinity, 'filterSizeMax')

export const activeFilterCount = computed(() => {
  let count = 0
  if (filterTypes().length > 0) count++
  if (filterSizeMin() > 0) count++
  if (filterSizeMax() < Infinity) count++
  if (searchQuery() !== '') count++
  if (!includeSubfolders()) count++
  return count
}, 'filters.activeCount')

export const filterSizeMinKb = computed(() => {
  const value = filterSizeMin()
  return value > 0 ? String(Math.round(value / 1024)) : ''
}, 'filters.sizeMinKb')

export const filterSizeMaxKb = computed(() => {
  const value = filterSizeMax()
  return value < Infinity ? String(Math.round(value / 1024)) : ''
}, 'filters.sizeMaxKb')

export const toggleFilterType = action((extension: string) => {
  filterTypes.set((previousTypes) => {
    if (previousTypes.includes(extension)) {
      return previousTypes.filter((type) => type !== extension)
    }
    return [...previousTypes, extension]
  })
}, 'filters.toggleType')

export const clearFilters = action(() => {
  filterTypes.set([])
  filterSizeMin.set(0)
  filterSizeMax.set(Infinity)
  searchQuery.set('')
  includeSubfolders.setTrue()
}, 'filters.clear')

export const setFilterSizeMinKb = action((kilobytes: number) => {
  if (!Number.isNaN(kilobytes)) {
    filterSizeMin.set(kilobytes * 1024)
  }
}, 'filters.setSizeMinKb')

export const setFilterSizeMaxKb = action((kilobytes: number | null) => {
  if (kilobytes === null) {
    filterSizeMax.set(Infinity)
    return
  }
  if (!Number.isNaN(kilobytes) && kilobytes > 0) {
    filterSizeMax.set(kilobytes * 1024)
  }
}, 'filters.setSizeMaxKb')

export const toggleSortOrder = action(() => {
  sortOrder.set((order) => (order === 'asc' ? 'desc' : 'asc'))
}, 'filters.toggleSortOrder')
