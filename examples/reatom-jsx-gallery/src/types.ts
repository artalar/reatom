export type ImageFileInfo = {
  name: string
  size: number
  type: string
  lastModified: number
}

export type ImageFile = {
  id: string
  name: string
  path: string
  relativePath: string
  fileHandle: FileSystemFileHandle
  fileInfo?: ImageFileInfo
}

export type FolderNode = {
  name: string
  path: string
  handle: FileSystemDirectoryHandle
  images: ImageFile[]
  children: FolderNode[]
  imageCount: number
}

export const VIEW_MODES = ['grid', 'list', 'table'] as const

export type ViewMode = (typeof VIEW_MODES)[number]
export type SortField = 'name' | 'size' | 'date' | 'type' | 'dimensions'
export type SortOrder = 'asc' | 'desc'
export type ImageFit = 'contain' | 'cover' | 'fill' | 'none'
export type GridGap = 'none' | 'small' | 'medium' | 'large' | 'xl'
export type ResolvedThemeMode = 'light' | 'dark'
export type ThemeMode = ResolvedThemeMode | 'system'
export type ThemePack =
  | 'blueprint'
  | 'neon'
  | 'terminal'
  | 'paper'
  | 'polaroid'
  | 'obsidian'
  | 'bauhaus'
  | 'aurora'
  | 'glass'
  | 'monochrome'
  | 'retroOs'

export const IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.avif',
  '.bmp',
  '.dng',
  '.arw',
  '.cr2',
  '.nef',
  '.orf',
  '.sr2',
]
export const GRID_GAP_VALUES: Record<GridGap, number> = {
  none: 0,
  small: 4,
  medium: 8,
  large: 16,
  xl: 24,
}

declare global {
  interface FileSystemDirectoryHandle {
    queryPermission?(descriptor: {
      mode: 'read' | 'readwrite'
    }): Promise<PermissionState>
    requestPermission?(descriptor: {
      mode: 'read' | 'readwrite'
    }): Promise<PermissionState>
  }
}

export {}
