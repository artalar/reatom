import { effect, isAbort, sleep, wrap } from '@reatom/core'

import type { GalleryFolderModel, GalleryImageModel, PreviewLoadPriority } from './contracts'
import {
  collectAllGalleryImages,
  folderModelTree,
  isFolderImagesInCurrentScope,
} from './collection'
import { currentFolder } from './folder'
import { includeSubfolders } from './filters'

export function setGalleryImagePreviewPriority(
  image: GalleryImageModel,
  next: PreviewLoadPriority,
) {
  if (image.previewLoadPriority() === next) return
  image.previewLoadPriority.set(next)
}

export function bindGalleryImagePreviewWhen(
  image: GalleryImageModel,
  readShouldConnect: () => boolean,
): () => void {
  const sync = () => {
    setGalleryImagePreviewPriority(
      image,
      readShouldConnect() ? 'high' : 'off',
    )
  }

  sync()
  const stopVisible = image.visible.subscribe(sync)
  const stopFolder = currentFolder.subscribe(sync)
  const stopSubfolders = includeSubfolders.subscribe(sync)

  return () => {
    stopVisible()
    stopFolder()
    stopSubfolders()
    if (image.previewLoadPriority() === 'high') {
      image.previewLoadPriority.set('off')
    }
  }
}

export function bindGalleryImagePreview(
  image: GalleryImageModel,
  folder: GalleryFolderModel,
): () => void {
  return bindGalleryImagePreviewWhen(
    image,
    () => isFolderImagesInCurrentScope(folder) && image.visible(),
  )
}

function isHighPriorityPreviewBusy(images: GalleryImageModel[]): boolean {
  return images.some(
    (image) => image.previewLoadPriority() === 'high' && image.thumbnail.pending(),
  )
}

function findBackgroundPreviewCandidate(
  images: GalleryImageModel[],
): GalleryImageModel | null {
  for (const image of images) {
    if (image.previewLoadPriority() !== 'off') continue
    if (image.thumbnail.ready() || image.thumbnail.pending()) continue
    return image
  }
  return null
}

export const bindBackgroundPreviewLoader = () => {
  const loader = effect(async () => {
    while (true) {
      await wrap(sleep(250))

      const tree = folderModelTree()
      if (!tree) continue

      const images = collectAllGalleryImages(tree)
      if (isHighPriorityPreviewBusy(images)) continue

      const candidate = findBackgroundPreviewCandidate(images)
      if (!candidate) continue

      candidate.previewLoadPriority.set('background')
      try {
        await wrap(candidate.thumbnail())
      } catch (error) {
        if (!isAbort(error)) throw error
      } finally {
        if (candidate.previewLoadPriority() === 'background') {
          candidate.previewLoadPriority.set('off')
        }
      }
    }
  }, 'gallery._backgroundPreviewLoader')

  return () => loader.unsubscribe()
}

export function ensureGalleryImagePreviewHigh(image: GalleryImageModel) {
  image.previewLoadPriority.set('high')
}
