import {
  filterPanelOpen,
  imageInfoPanelOpen,
  settingsPanelOpen,
} from '../components/panelState'
import {
  clearSelection,
  currentFolder,
  currentImages,
  folderTree,
  keepLightboxView,
  lightboxImage,
  lightboxOpen,
  lightboxPanX,
  lightboxPanY,
  lightboxZoom,
  parsingProgress,
  resetGallerySession,
  showLightboxScrubber,
  slideshowPlaying,
  viewMode,
  wrapFolderNavigation,
} from '../model'
import type { FolderNode, ImageFile } from '../types'

function cloneImage(img: ImageFile): ImageFile {
  return { ...img }
}

function cloneFolder(folder: FolderNode): FolderNode {
  return {
    ...folder,
    images: folder.images.map(cloneImage),
    children: folder.children.map(cloneFolder),
  }
}

function findFolderByPath(folder: FolderNode, path: string): FolderNode | null {
  if (folder.path === path) return folder

  for (const child of folder.children) {
    const found = findFolderByPath(child, path)
    if (found) return found
  }

  return null
}

export type LoadGalleryStateOptions = {
  tree: FolderNode
  currentFolderNode?: FolderNode
}

export function loadGalleryState(options: LoadGalleryStateOptions): void {
  resetGallerySession()
  const tree = cloneFolder(options.tree)
  const currentFolderNode = options.currentFolderNode
    ? findFolderByPath(tree, options.currentFolderNode.path)
    : undefined
  folderTree.set(tree)
  currentFolder.set(currentFolderNode ?? tree)
  parsingProgress.set({
    total: tree.imageCount,
    current: tree.imageCount,
  })
  currentImages()
  clearSelection()
  lightboxOpen.hide()
  lightboxImage.set(null)
  lightboxZoom.set(1)
  lightboxPanX.set(0)
  lightboxPanY.set(0)
  slideshowPlaying.setFalse()
  wrapFolderNavigation.setTrue()
  keepLightboxView.setFalse()
  showLightboxScrubber.setTrue()
  viewMode.setGrid()
  filterPanelOpen.hide()
  settingsPanelOpen.hide()
  imageInfoPanelOpen.hide()
}

export function loadGalleryStateWithImageModels(
  options: LoadGalleryStateOptions,
): void {
  loadGalleryState(options)
}

export function loadEmptyState(): void {
  resetGallerySession()
  folderTree.set(null)
  currentFolder.set(null)
  parsingProgress.set({
    total: 0,
    current: 0,
  })
  currentImages()
  clearSelection()
  lightboxOpen.hide()
  lightboxImage.set(null)
  lightboxZoom.set(1)
  lightboxPanX.set(0)
  lightboxPanY.set(0)
  slideshowPlaying.setFalse()
  wrapFolderNavigation.setTrue()
  keepLightboxView.setFalse()
  showLightboxScrubber.setTrue()
  viewMode.setGrid()
  filterPanelOpen.hide()
  settingsPanelOpen.hide()
  imageInfoPanelOpen.hide()
}

export type ParsingProgress = {
  total: number
  current: number
}

export function loadParsingState(progress: ParsingProgress): void {
  parsingProgress.set(progress)
}
