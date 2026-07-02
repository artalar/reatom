import type { Computed } from '@reatom/core'
import { action, computed } from '@reatom/core'

import { shutdownRawDevelopPool } from '../image-engine/formats/rawDevelop'
import { shutdownRawPreviewScanPool } from '../image-engine/formats/rawPreviewScanPool'
import type { FolderNode, ImageFile } from '../types'
import type { GalleryImageModel } from './contracts'
import { includeSubfolders, sortField, sortOrder } from './filters'
import { currentFolder, folderTree } from './folder'
import { isGalleryImageModel, reatomGalleryImage } from './image'
import { shutdownImageDecodeQueue } from './imageDecodeConcurrency'
import { shutdownThumbnailQueue } from './thumbnailConcurrency'

export type GalleryFolderModel = {
  source: FolderNode
  images: GalleryImageModel[]
  children: GalleryFolderModel[]
  sortedImages: Computed<GalleryImageModel[]>
}

const imageModelById = new Map<string, GalleryImageModel>()
const folderModelByPath = new Map<string, GalleryFolderModel>()

function getImageModel(image: ImageFile | GalleryImageModel): GalleryImageModel {
  if (isGalleryImageModel(image)) return image

  const cached = imageModelById.get(image.id)
  if (cached) return cached

  const model = reatomGalleryImage(image)
  imageModelById.set(image.id, model)
  return model
}

function sortImages(images: GalleryImageModel[]): GalleryImageModel[] {
  const field = sortField()
  const order = sortOrder()

  return [...images].sort((left, right) => {
    let comparison = 0
    switch (field) {
      case 'name':
        comparison = left.source.name.localeCompare(right.source.name)
        break
      case 'size':
        comparison =
          (left.fileInfo.data()?.size ?? 0) - (right.fileInfo.data()?.size ?? 0)
        break
      case 'date':
        comparison =
          (left.fileInfo.data()?.lastModified ?? 0) -
          (right.fileInfo.data()?.lastModified ?? 0)
        break
      case 'type':
        comparison = (left.fileInfo.data()?.type ?? '').localeCompare(
          right.fileInfo.data()?.type ?? '',
        )
        break
      case 'dimensions':
        comparison =
          left.width() * left.height() - right.width() * right.height()
        break
    }
    return order === 'asc' ? comparison : -comparison
  })
}

function createFolderModel(folder: FolderNode): GalleryFolderModel {
  const cached = folderModelByPath.get(folder.path)
  if (cached && cached.source === folder) return cached

  const images = folder.images.map(getImageModel)
  const model: GalleryFolderModel = {
    source: folder,
    images,
    children: folder.children.map(createFolderModel),
    sortedImages: computed(
      () => sortImages(images),
      `galleryFolder.${folder.path}.sortedImages`,
    ),
  }
  folderModelByPath.set(folder.path, model)
  return model
}

export const folderModelTree = computed(() => {
  const tree = folderTree()
  return tree ? createFolderModel(tree) : null
}, 'folderModelTree')

export function collectAllGalleryImages(
  folder: GalleryFolderModel,
): GalleryImageModel[] {
  return [
    ...folder.images,
    ...folder.children.flatMap(collectAllGalleryImages),
  ]
}

function findFolderModel(
  folder: GalleryFolderModel,
  path: string,
): GalleryFolderModel | null {
  if (folder.source.path === path) return folder

  for (const child of folder.children) {
    const found = findFolderModel(child, path)
    if (found) return found
  }

  return null
}

function collectImages(
  folder: GalleryFolderModel,
  withSubfolders: boolean,
): GalleryImageModel[] {
  const images = folder.sortedImages()
  if (!withSubfolders) return images

  return [
    ...images,
    ...folder.children.flatMap((child) => collectImages(child, true)),
  ]
}

export const resetGallerySession = action(() => {
  shutdownRawPreviewScanPool()
  shutdownRawDevelopPool()
  shutdownThumbnailQueue()
  shutdownImageDecodeQueue()
  imageModelById.clear()
  folderModelByPath.clear()
}, 'collection.resetGallerySession')

export const currentImages = computed(() => {
  const root = folderModelTree()
  if (!root) return []

  const selectedFolder = currentFolder()
  if (!selectedFolder) return collectImages(root, true)

  const selectedFolderModel = findFolderModel(root, selectedFolder.path)
  if (!selectedFolderModel) return []

  return collectImages(selectedFolderModel, includeSubfolders())
}, 'currentImages')

export const visibleImages = computed(
  () => currentImages().filter((node) => node.visible()),
  'visibleImages',
)

export const visibleIndexMap = computed(() => {
  const map = new Map<GalleryImageModel, number>()
  for (const [index, node] of visibleImages().entries()) {
    map.set(node, index)
  }
  return map
}, 'visibleIndexMap')

export const selectedImages = computed(
  () => currentImages().filter((node) => node.selected()),
  'selectedImages',
)

export const primarySelectedImage = computed(
  () => selectedImages()[0] ?? null,
  'primarySelectedImage',
)

export const selectedCount = computed(
  () => selectedImages().length,
  'selectedCount',
)

export const favoriteImages = computed(() => {
  return currentImages()
    .filter((model) => model.favorite())
    .map((model) => model.source)
}, 'favoriteImages')

export const favoritesCount = computed(
  () => currentImages().filter((model) => model.favorite()).length,
  'favoritesCount',
)

export const selectImage = action((model: GalleryImageModel) => {
  model.selected.set(!model.selected())
}, 'selectImage')

export const selectAllImages = action(() => {
  const map = visibleIndexMap()
  for (const model of map.keys()) {
    model.selected.set(true)
  }
}, 'selectAllImages')

export const clearSelection = action(() => {
  for (const node of currentImages()) {
    node.selected.set(false)
  }
}, 'clearSelection')

export const findVisibleNeighbor = (
  source: GalleryImageModel,
  direction: 1 | -1,
  wrapNavigation: boolean,
) => {
  const images = visibleImages()
  const currentIndex = images.indexOf(source)
  if (currentIndex === -1) return null

  const nextIndex = currentIndex + direction
  if (nextIndex >= 0 && nextIndex < images.length) {
    return images[nextIndex] ?? null
  }

  if (!wrapNavigation || images.length <= 1) return null
  return direction === 1 ? (images[0] ?? null) : (images.at(-1) ?? null)
}

function isSameOrDescendant(folderPath: string, rootPath: string): boolean {
  return (
    rootPath === '' ||
    folderPath === rootPath ||
    folderPath.startsWith(rootPath + '/')
  )
}

function isAncestor(folderPath: string, childPath: string): boolean {
  return (
    folderPath === '' ||
    folderPath === childPath ||
    childPath.startsWith(folderPath + '/')
  )
}

export function isFolderImagesInCurrentScope(
  folder: GalleryFolderModel,
): boolean {
  const selectedFolder = currentFolder()
  if (!selectedFolder) return true
  if (folder.source.path === selectedFolder.path) return true
  return (
    includeSubfolders() &&
    isSameOrDescendant(folder.source.path, selectedFolder.path)
  )
}

export function isFolderBranchInCurrentScope(
  folder: GalleryFolderModel,
): boolean {
  const selectedFolder = currentFolder()
  if (!selectedFolder) return true
  if (isFolderImagesInCurrentScope(folder)) return true
  return isAncestor(folder.source.path, selectedFolder.path)
}
