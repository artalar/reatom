export const RAW_IMAGE_FORMATS = [
  'dng',
  'arw',
  'cr2',
  'nef',
  'orf',
  'sr2',
] as const

export type RawImageFormat = (typeof RAW_IMAGE_FORMATS)[number]

export type ImageFormat =
  | 'jpeg'
  | 'png'
  | 'gif'
  | 'webp'
  | 'bmp'
  | 'svg'
  | 'avif'
  | RawImageFormat
  | 'unknown'

export function isRawImageFormat(
  format: ImageFormat | null | undefined,
): format is RawImageFormat {
  switch (format) {
    case 'dng':
    case 'arw':
    case 'cr2':
    case 'nef':
    case 'orf':
    case 'sr2':
      return true
    default:
      return false
  }
}

export type ExifData = Record<string, string>

export type EmbeddedPreview = {
  blob: Blob
  width?: number
  height?: number
}

export type ImageMeta = {
  width: number
  height: number
  format: ImageFormat
  isProgressive: boolean
  hasExifThumbnail: boolean
  exif?: ExifData
  embeddedPreview?: EmbeddedPreview
}

export type ThumbnailOptions = {
  maxSize?: number
  quality?: number
  signal?: AbortSignal
}

export type ThumbnailSource = 'exif' | 'generated'

export type ThumbnailResult = {
  url: string
  width: number
  height: number
  source: ThumbnailSource
  orientationBaked?: boolean
}

export const HEADER_READ_BYTES = 32768
export const EXIF_READ_BYTES = 512_000

export function resolveExifReadBytes(fileSize: number): number {
  return Math.min(fileSize, EXIF_READ_BYTES)
}
export const DEFAULT_MAX_SIZE = 300
export const DEFAULT_QUALITY = 0.75
