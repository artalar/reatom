import { abortVar, throwAbort, wrap } from '@reatom/core'

import type { ParsingProgressSnapshot } from './models/contracts'
import type { FolderNode, ImageFile } from './types'
import { IMAGE_EXTENSIONS } from './types'
import { yieldToBrowser } from './yieldToBrowser'

const DIRECTORY_SCAN_YIELD_INTERVAL = 250

export function isFileSystemAccessSupported(): boolean {
  return 'showDirectoryPicker' in globalThis
}

declare function showDirectoryPicker(options?: {
  mode?: string
}): Promise<FileSystemDirectoryHandle>

export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  return await wrap(showDirectoryPicker({ mode: 'read' }))
}

function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex === -1) return ''
  return filename.slice(dotIndex).toLowerCase()
}

function isFileHandle(entry: FileSystemHandle): entry is FileSystemFileHandle {
  return entry.kind === 'file'
}

function isDirectoryHandle(
  entry: FileSystemHandle,
): entry is FileSystemDirectoryHandle {
  return entry.kind === 'directory'
}

export type ScanDirectoryOptions = {
  onProgress?: (snapshot: ParsingProgressSnapshot) => void
}

export async function scanDirectoryRecursive(
  rootHandle: FileSystemDirectoryHandle,
  options?: ScanDirectoryOptions,
): Promise<{ tree: FolderNode }> {
  let progress: ParsingProgressSnapshot = { total: 0, current: 0 }
  let indexedImages = 0

  const reportProgress = (
    next:
      | ParsingProgressSnapshot
      | ((state: ParsingProgressSnapshot) => ParsingProgressSnapshot),
  ) => {
    progress = typeof next === 'function' ? next(progress) : next
    options?.onProgress?.(progress)
  }

  reportProgress({ total: 0, current: 0 })
  abortVar.subscribe(() => reportProgress({ total: 0, current: 0 }))

  async function walkTree(
    dirHandle: FileSystemDirectoryHandle,
    currentPath: string,
  ): Promise<FolderNode> {
    const folderNode: FolderNode = {
      name: dirHandle.name,
      path: currentPath,
      handle: dirHandle,
      images: [],
      children: [],
      imageCount: 0,
    }
    let imageCount = 0
    const subdirectoryHandles: FileSystemDirectoryHandle[] = []
    let scannedEntries = 0

    const iterator = dirHandle.values()
    while (true) {
      if (abortVar.require().signal.aborted) throwAbort()
      const { value: entry, done } = await wrap(iterator.next())
      if (done) break
      scannedEntries++
      if (isFileHandle(entry)) {
        const extension = getFileExtension(entry.name)
        if (IMAGE_EXTENSIONS.includes(extension)) {
          const image: ImageFile = {
            id: `${currentPath}/${entry.name}#${folderNode.images.length}`,
            name: entry.name,
            path: currentPath,
            relativePath: currentPath ? `${currentPath}/${entry.name}` : entry.name,
            fileHandle: entry,
          }
          folderNode.images.push(image)
          imageCount++
        }
      } else if (isDirectoryHandle(entry)) {
        subdirectoryHandles.push(entry)
      }

      if (scannedEntries % DIRECTORY_SCAN_YIELD_INTERVAL === 0) {
        await wrap(yieldToBrowser())
      }
    }

    for (const subDirHandle of subdirectoryHandles) {
      const childPath = currentPath
        ? `${currentPath}/${subDirHandle.name}`
        : subDirHandle.name
      const childNode = await wrap(walkTree(subDirHandle, childPath))
      folderNode.children.push(childNode)
      imageCount += childNode.imageCount
    }

    folderNode.imageCount = imageCount
    indexedImages += folderNode.images.length

    reportProgress({
      total: Math.max(progress.total, indexedImages, 1),
      current: indexedImages,
    })

    return folderNode
  }

  const walkRoot = await wrap(walkTree(rootHandle, ''))
  reportProgress({ total: walkRoot.imageCount, current: walkRoot.imageCount })

  return { tree: walkRoot }
}

export const parseDirectoryRecursive = scanDirectoryRecursive
