import { action, clearStack, context, withAbort, wrap } from '@reatom/core'
import { expect, test, vi } from 'vitest'

import { createMockDirHandle } from './__fixtures__/fixtureLoader'
import { createMockImage, mockFolderTree } from './__fixtures__/mockData'
import { scanDirectoryRecursive } from './filesystem'
import {
  clearSelection,
  closeLightbox,
  currentFolder,
  currentImages,
  filterSizeMax,
  filterSizeMin,
  filterTypes,
  includeSubfolders,
  keepLightboxView,
  lightboxImage,
  lightboxOpen,
  lightboxPanX,
  lightboxPanY,
  lightboxZoom,
  navigateLightbox,
  openFolder,
  openLightbox,
  searchQuery,
  selectAllImages,
  selectedCount,
  selectImage,
  slideshowPlaying,
  sortField,
  sortOrder,
  visibleIndexMap,
  wrapFolderNavigation,
} from './model'
import { loadGalleryState } from './shared/testSetup'
import type { FolderNode, ImageFile } from './types'

function collectTreeImages(
  folder: FolderNode,
  compare: (left: ImageFile, right: ImageFile) => number,
): ImageFile[] {
  return [
    ...folder.images.toSorted(compare),
    ...folder.children.flatMap((child) => collectTreeImages(child, compare)),
  ]
}

test.beforeEach(() => {
  clearStack()
})

test.afterEach(() => {
  vi.unstubAllGlobals()
})

test('imagesList sorts each folder by name ascending', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    sortField.set('name')
    sortOrder.set('asc')
    const images = currentImages()
    const names = images.map((i) => i.source.name)
    const expectedNames = collectTreeImages(mockFolderTree, (left, right) =>
      left.name.localeCompare(right.name),
    ).map((image) => image.name)
    expect(names).toEqual(expectedNames)
  }))

test('imagesList sorts each folder by name descending', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    sortField.set('name')
    sortOrder.set('desc')
    const images = currentImages()
    const names = images.map((i) => i.source.name)
    const expectedNames = collectTreeImages(mockFolderTree, (left, right) =>
      right.name.localeCompare(left.name),
    ).map((image) => image.name)
    expect(names).toEqual(expectedNames)
  }))

test('imagesList sorts each folder by size ascending', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    sortField.set('size')
    sortOrder.set('asc')
    const images = currentImages()
    const sizes = images.map((i) => i.fileInfo.data()?.size)
    const expectedSizes = collectTreeImages(
      mockFolderTree,
      (left, right) =>
        (left.fileInfo?.size ?? 0) - (right.fileInfo?.size ?? 0),
    ).map((image) => image.fileInfo?.size)
    expect(sizes).toEqual(expectedSizes)
  }))

test('imagesList sorts each folder by size descending', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    sortField.set('size')
    sortOrder.set('desc')
    const images = currentImages()
    const sizes = images.map((i) => i.fileInfo.data()?.size)
    const expectedSizes = collectTreeImages(
      mockFolderTree,
      (left, right) =>
        (right.fileInfo?.size ?? 0) - (left.fileInfo?.size ?? 0),
    ).map((image) => image.fileInfo?.size)
    expect(sizes).toEqual(expectedSizes)
  }))

test('imagesList sorts each folder by date ascending', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    sortField.set('date')
    sortOrder.set('asc')
    const images = currentImages()
    const dates = images.map((i) => i.fileInfo.data()?.lastModified)
    const expectedDates = collectTreeImages(
      mockFolderTree,
      (left, right) =>
        (left.fileInfo?.lastModified ?? 0) -
        (right.fileInfo?.lastModified ?? 0),
    ).map((image) => image.fileInfo?.lastModified)
    expect(dates).toEqual(expectedDates)
  }))

test('imagesList sorts each folder by type', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    sortField.set('type')
    sortOrder.set('asc')
    const images = currentImages()
    const types = images.map((i) => i.fileInfo.data()?.type)
    const expectedTypes = collectTreeImages(mockFolderTree, (left, right) =>
      (left.fileInfo?.type ?? '').localeCompare(right.fileInfo?.type ?? ''),
    ).map((image) => image.fileInfo?.type)
    expect(types).toEqual(expectedTypes)
  }))

test('imagesList sorts by dimensions', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    sortField.set('dimensions')
    sortOrder.set('asc')
    const images = currentImages()
    const areas = images.map((i) => i.width() * i.height())
    expect(areas).toEqual([...areas].sort((a, b) => a - b))
  }))

test('visibleIndexMap filters by type', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    filterTypes.set(new Set(['jpg']))
    const map = visibleIndexMap()
    expect([...map.keys()].every((i) => i.source.name.endsWith('.jpg'))).toBe(
      true,
    )
    expect(map.size).toBeLessThan(mockFolderTree.imageCount)
  }))

test('visibleIndexMap filters by search query', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    searchQuery.set('Quarterly')
    const map = visibleIndexMap()
    expect(map.size).toBe(1)
    expect([...map.keys()][0]?.source.name).toBe('Quarterly report.png')
  }))

test('visibleIndexMap filters by size range', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    filterSizeMin.set(5000)
    filterSizeMax.set(10000)
    const map = visibleIndexMap()
    expect(
      [...map.keys()].every((i) => {
        const size = i.fileInfo.data()?.size
        return size !== undefined && size >= 5000 && size <= 10000
      }),
    ).toBe(true)
  }))

test('visibleIndexMap respects includeSubfolders', async () =>
  context.start(async () => {
    loadGalleryState({
      tree: mockFolderTree,
      currentFolderNode: mockFolderTree,
    })
    includeSubfolders.setTrue()
    const withSub = visibleIndexMap().size
    includeSubfolders.setFalse()
    await wrap(Promise.resolve())
    const withoutSub = visibleIndexMap().size
    expect(withSub).toBeGreaterThan(withoutSub)
  }))

test('imagesList is scoped to the selected folder', async () =>
  context.start(async () => {
    loadGalleryState({ tree: mockFolderTree })
    currentFolder.set(mockFolderTree.children[0]!)
    await wrap(Promise.resolve())

    const paths = currentImages().map((image) => image.source.path)

    expect(paths).toEqual(['subfolder', 'subfolder'])
  }))

test('scanDirectoryRecursive yields while indexing large folders', async () => {
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    callback(performance.now())
    return 1
  })
  vi.stubGlobal('requestAnimationFrame', requestAnimationFrame)

  const fileHandles = Array.from(
    { length: 401 },
    (_, index) =>
      createMockImage({
        id: `scan-${index}`,
        name: `image-${index}.jpg`,
        path: '',
      }).fileHandle,
  )
  const rootHandle = Object.assign(createMockDirHandle('Root'), {
    values: async function* () {
      for (const fileHandle of fileHandles) {
        yield fileHandle
      }
    },
  })
  const scan = action(
    async () => await wrap(scanDirectoryRecursive(rootHandle)),
    'test.scanDirectoryRecursive',
  ).extend(withAbort())

  const result = await context.start(() => scan())

  expect(result.tree.images).toHaveLength(fileHandles.length)
  expect(requestAnimationFrame).toHaveBeenCalled()
})

test('selectImage toggles selection', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    const model = [...visibleIndexMap().keys()][0]
    expect(model).toBeDefined()
    selectImage(model!)
    expect(model!.selected()).toBe(true)
    selectImage(model!)
    expect(model!.selected()).toBe(false)
  }))

test('selectAllImages selects all visible', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    selectAllImages()
    const visibleCount = visibleIndexMap().size
    expect(selectedCount()).toBe(visibleCount)
  }))

test('clearSelection clears all', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    selectAllImages()
    clearSelection()
    expect(selectedCount()).toBe(0)
  }))

test('openLightbox sets image and opens', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    const visible = [...visibleIndexMap().keys()]
    const target = visible[2]!
    openLightbox(target)
    expect(lightboxImage()).toBe(target)
  }))

test('closeLightbox resets preview state', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    const visible = [...visibleIndexMap().keys()]
    openLightbox(visible[0]!)
    lightboxZoom.set(4)
    lightboxPanX.set(16)
    lightboxPanY.set(-12)
    slideshowPlaying.setTrue()
    closeLightbox()
    expect(lightboxOpen()).toBe(false)
    expect(slideshowPlaying()).toBe(false)
    expect(lightboxZoom()).toBe(1)
    expect(lightboxPanX()).toBe(0)
    expect(lightboxPanY()).toBe(0)
  }))

test('navigateLightbox wraps around', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    const visible = [...visibleIndexMap().keys()]
    openLightbox(visible[0]!)
    navigateLightbox(-1)
    expect(lightboxImage()).toBe(visible[visible.length - 1])
    navigateLightbox(1)
    expect(lightboxImage()).toBe(visible[0])
  }))

test('navigateLightbox stops at folder ends when wrap is disabled', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    wrapFolderNavigation.setFalse()
    const visible = [...visibleIndexMap().keys()]
    openLightbox(visible[0]!)
    navigateLightbox(-1)
    expect(lightboxImage()).toBe(visible[0])
  }))

test('navigateLightbox skips filtered images', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    searchQuery.set('photo')
    const visible = [...visibleIndexMap().keys()]
    openLightbox(visible[0]!)
    navigateLightbox(1)
    expect(lightboxImage()).toBe(visible[1])
    expect(lightboxImage()?.source.name).toBe('photo2.png')
  }))

test('navigateLightbox keeps zoom and pan when keep view is enabled', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    keepLightboxView.setTrue()
    const visible = [...visibleIndexMap().keys()]
    openLightbox(visible[0]!)
    lightboxZoom.set(3)
    lightboxPanX.set(24)
    lightboxPanY.set(-8)
    navigateLightbox(1)
    expect(lightboxImage()).toBe(visible[1])
    expect(lightboxZoom()).toBe(3)
    expect(lightboxPanX()).toBe(24)
    expect(lightboxPanY()).toBe(-8)
  }))

test('favorite.toggle adds and removes', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    const model = [...visibleIndexMap().keys()][0]
    expect(model).toBeDefined()
    model!.favorite.toggle()
    expect(model!.favorite()).toBe(true)
    model!.favorite.toggle()
    expect(model!.favorite()).toBe(false)
  }))

test('openFolder.abort clears parsing state', () =>
  context.start(() => {
    loadGalleryState({ tree: mockFolderTree })
    openFolder.abort()
  }))
