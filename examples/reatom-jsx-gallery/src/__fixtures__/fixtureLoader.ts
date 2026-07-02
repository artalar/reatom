import type { FolderNode, ImageFile } from '../types'
import {
  type FixtureManifestEntry,
  fixturePathBasename,
  fixturePathDirname,
  type FixtureTier,
  listFixtures,
  mimeFromFilename,
} from './fixtureManifest'

export type { FixtureManifestEntry, FixtureTier } from './fixtureManifest'
export { listFixtures, mimeFromFilename } from './fixtureManifest'

const fixtureAssetUrls = import.meta.glob('./images/**/*', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

const personalFixtureAssetUrls = import.meta.glob('./personal/*', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const personalFixtureEntries = [
  {
    name: 'DSC08224.jpg',
    width: 9183,
    height: 5859,
    size: 23_522_946,
  },
  {
    name: 'DSC08225.jpg',
    width: 9183,
    height: 5859,
    size: 20_397_162,
  },
  {
    name: 'DSC08226.jpg',
    width: 9183,
    height: 5859,
    size: 22_687_547,
  },
  {
    name: 'DSC08249.jpg',
    width: 9183,
    height: 5859,
    size: 17_503_162,
  },
] as const

export type PersonalFixtureEntry = (typeof personalFixtureEntries)[number]

function fixtureAssetUrl(tier: FixtureTier, relativePath: string): string {
  const normalizedPath = relativePath.replace(/\\/g, '/')
  const key = `./images/${tier}/${normalizedPath}`
  const url = fixtureAssetUrls[key]
  if (!url) {
    throw new Error(`Missing fixture asset URL for ${tier}/${normalizedPath}`)
  }
  return url
}

export function createMockDirHandle(name: string): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    getDirectoryHandle: () => Promise.reject(new Error('Not implemented')),
    getFileHandle: () => Promise.reject(new Error('Not implemented')),
    removeEntry: () => Promise.reject(new Error('Not implemented')),
    resolve: () => Promise.reject(new Error('Not implemented')),
    keys: async function* () {},
    values: async function* () {},
    entries: async function* () {},
    isSameEntry: () => Promise.resolve(false),
  } as unknown as FileSystemDirectoryHandle
}

export function createFixtureFileHandle(
  tier: FixtureTier,
  relativePath: string,
): FileSystemFileHandle {
  const name = fixturePathBasename(relativePath)
  const mime = mimeFromFilename(name)
  const assetUrl = fixtureAssetUrl(tier, relativePath)

  return {
    kind: 'file',
    name,
    getFile: async () => {
      const response = await fetch(assetUrl)
      const blob = await response.blob()
      return new File([await blob.arrayBuffer()], name, {
        type: mime,
        lastModified: 1700000000000,
      })
    },
    isSameEntry: () => Promise.resolve(false),
  } as unknown as FileSystemFileHandle
}

function createImageFromFixture(
  entry: FixtureManifestEntry,
  folderPath: string,
): ImageFile {
  const name = fixturePathBasename(entry.dest)
  const id = `fixture-${entry.sha256.slice(0, 12)}`

  return {
    id,
    name,
    path: folderPath,
    relativePath: folderPath ? `${folderPath}/${name}` : name,
    fileInfo: {
      name,
      size: entry.size,
      type: mimeFromFilename(name),
      lastModified: 1700000000000,
    },
    fileHandle: createFixtureFileHandle(entry.tier, entry.dest),
  }
}

function getOrCreateFolder(
  root: FolderNode,
  folderMap: Map<string, FolderNode>,
  folderPath: string,
): FolderNode {
  if (!folderPath) return root

  const existing = folderMap.get(folderPath)
  if (existing) return existing

  const segments = folderPath.split('/')
  let currentPath = ''
  let parent = root

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment
    const cached = folderMap.get(currentPath)
    if (cached) {
      parent = cached
      continue
    }

    const folder: FolderNode = {
      name: segment,
      path: currentPath,
      handle: createMockDirHandle(segment),
      images: [],
      children: [],
      imageCount: 0,
    }
    parent.children.push(folder)
    folderMap.set(currentPath, folder)
    parent = folder
  }

  return parent
}

function personalFixtureAssetUrl(name: string): string {
  const url = personalFixtureAssetUrls[`./personal/${name}`]
  if (!url) {
    throw new Error(`Missing personal fixture asset URL for ${name}`)
  }
  return url
}

export function createPersonalFixtureFileHandle(
  entry: PersonalFixtureEntry,
): FileSystemFileHandle {
  const assetUrl = personalFixtureAssetUrl(entry.name)
  const mime = mimeFromFilename(entry.name)

  return {
    kind: 'file',
    name: entry.name,
    getFile: async () => {
      const response = await fetch(assetUrl)
      const blob = await response.blob()
      return new File([await blob.arrayBuffer()], entry.name, {
        type: mime,
        lastModified: 1700000000000,
      })
    },
    isSameEntry: () => Promise.resolve(false),
  } as unknown as FileSystemFileHandle
}

function createImageFromPersonalFixture(
  entry: PersonalFixtureEntry,
): ImageFile {
  return {
    id: `personal-${entry.name}`,
    name: entry.name,
    path: '',
    relativePath: entry.name,
    fileInfo: {
      name: entry.name,
      size: entry.size,
      type: mimeFromFilename(entry.name),
      lastModified: 1700000000000,
    },
    fileHandle: createPersonalFixtureFileHandle(entry),
  }
}

export function buildPersonalFixtureFolderTree(): FolderNode {
  const images = personalFixtureEntries.map(createImageFromPersonalFixture)
  return {
    name: 'PersonalFixtures',
    path: '',
    handle: createMockDirHandle('PersonalFixtures'),
    images,
    children: [],
    imageCount: images.length,
  }
}

export function buildFixtureFolderTree(tier: FixtureTier): FolderNode {
  const root: FolderNode = {
    name: 'Fixtures',
    path: '',
    handle: createMockDirHandle('Fixtures'),
    images: [],
    children: [],
    imageCount: 0,
  }
  const folderMap = new Map<string, FolderNode>([['', root]])

  for (const entry of listFixtures(tier)) {
    const folderPath = fixturePathDirname(entry.dest)
    const normalizedFolderPath =
      folderPath === '.' ? '' : folderPath.replace(/\\/g, '/')
    const folder = getOrCreateFolder(root, folderMap, normalizedFolderPath)
    folder.images.push(createImageFromFixture(entry, normalizedFolderPath))
    folder.imageCount += 1
    root.imageCount += 1
  }

  return root
}
