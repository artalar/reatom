import { effect, isAbort, sleep, wrap } from '@reatom/core'

import {
  collectAllGalleryImages,
  folderModelTree,
  type GalleryFolderModel,
  isFolderImagesInCurrentScope,
} from './collection'
import type { GalleryImageModel } from './contracts'
import { includeSubfolders } from './filters'
import { currentFolder } from './folder'

/**
 * Several bindings (grid, list, table entries) can demand the same image at
 * once, and on view-mode switches the new binding mounts before the old one
 * unmounts. A per-image counter keeps the priority owned by "how many live
 * bindings want it" instead of by whichever callback ran last.
 */
const highDemandCounts = new WeakMap<GalleryImageModel, number>()

function changeHighDemand(image: GalleryImageModel, delta: 1 | -1): void {
  const next = Math.max(0, (highDemandCounts.get(image) ?? 0) + delta)
  highDemandCounts.set(image, next)
}

function applyHighDemand(image: GalleryImageModel): void {
  const demanded = (highDemandCounts.get(image) ?? 0) > 0
  const priority = image.previewLoadPriority()

  if (demanded) {
    if (priority !== 'high') image.previewLoadPriority.set('high')
  } else if (priority === 'high') {
    image.previewLoadPriority.set('off')
  }
}

export function bindGalleryImagePreviewWhen(
  image: GalleryImageModel,
  readShouldConnect: () => boolean,
): () => void {
  let wantsHigh = false

  const sync = () => {
    const shouldConnect = readShouldConnect()
    if (shouldConnect !== wantsHigh) {
      wantsHigh = shouldConnect
      changeHighDemand(image, shouldConnect ? 1 : -1)
    }
    applyHighDemand(image)
  }

  sync()
  const stopVisible = image.visible.subscribe(sync)
  const stopFolder = currentFolder.subscribe(sync)
  const stopSubfolders = includeSubfolders.subscribe(sync)

  return () => {
    stopVisible()
    stopFolder()
    stopSubfolders()
    if (wantsHigh) {
      wantsHigh = false
      changeHighDemand(image, -1)
      applyHighDemand(image)
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
    (image) =>
      image.previewLoadPriority() === 'high' && image.thumbnail.pending(),
  )
}

function findBackgroundPreviewCandidate(
  images: GalleryImageModel[],
): GalleryImageModel | null {
  for (const image of images) {
    if (image.previewLoadPriority() !== 'off') continue
    if (image.thumbnail.data() !== undefined) continue
    if (image.thumbnail.pending() > 0) continue
    if (image.thumbnail.error() != null) continue
    return image
  }
  return null
}

export const bindBackgroundPreviewLoader = () => {
  const loader = effect(async () => {
    while (true) {
      // Aborting the effect (unmount) rejects this wrapped sleep and exits.
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
        // A single broken file must not stop the loop; the errored thumbnail
        // is skipped by the candidate check on the next pass.
        if (!isAbort(error)) {
          console.error('Background preview load failed:', error)
        }
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
