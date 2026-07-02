export type RawEncodeRequest = {
  id: number
  rgb: ArrayBuffer
  width: number
  height: number
  quality: number
  degrees: number
  mirrored: boolean
  maxDimension?: number
}

export type RawEncodeResponse =
  | { id: number; blob: Blob }
  | { id: number; error: string }
