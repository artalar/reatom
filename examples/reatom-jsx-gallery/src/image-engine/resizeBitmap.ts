import { longEdge, type Size } from './decodePolicy'
import {
  applyOrientationToImageBitmap,
  getOrientationFromExif,
} from './orientation'
import type { ImageMeta } from './types'

const MAX_ITERATIVE_HALVING_RATIO = 2

function throwIfBitmapDecodeAborted(
  signal: AbortSignal,
  bitmaps: ImageBitmap[],
): void {
  if (!signal.aborted) return
  for (const bitmap of bitmaps) bitmap.close()
  throw signal.reason ?? new DOMException('Bitmap decode aborted', 'AbortError')
}

async function resizeBitmapTowardTarget(
  bitmap: ImageBitmap,
  target: Size,
  signal: AbortSignal,
): Promise<ImageBitmap> {
  let current = bitmap
  let iterations = 0

  while (
    longEdge({ width: current.width, height: current.height }) /
      longEdge(target) >
      MAX_ITERATIVE_HALVING_RATIO &&
    iterations < 8
  ) {
    iterations += 1
    const nextWidth = Math.max(
      target.width,
      Math.round(current.width / MAX_ITERATIVE_HALVING_RATIO),
    )
    const nextHeight = Math.max(
      target.height,
      Math.round(current.height / MAX_ITERATIVE_HALVING_RATIO),
    )
    const next = await createImageBitmap(current, {
      resizeWidth: nextWidth,
      resizeHeight: nextHeight,
      resizeQuality: 'medium',
    })
    throwIfBitmapDecodeAborted(signal, [current, next])
    current.close()
    current = next
  }

  if (current.width === target.width && current.height === target.height) {
    return current
  }

  const resized = await createImageBitmap(current, {
    resizeWidth: target.width,
    resizeHeight: target.height,
    resizeQuality: 'medium',
  })
  throwIfBitmapDecodeAborted(signal, [current, resized])
  current.close()
  return resized
}

export async function decodeBlobToCanvas(
  source: Blob,
  target: Size,
  meta: ImageMeta | null,
  ignoreExifOrientation: boolean,
  signal: AbortSignal,
): Promise<HTMLCanvasElement> {
  let bitmap = await createImageBitmap(source, {
    resizeWidth: target.width,
    resizeHeight: target.height,
    resizeQuality: 'medium',
    imageOrientation: 'none',
  })
  throwIfBitmapDecodeAborted(signal, [bitmap])

  bitmap = await resizeBitmapTowardTarget(bitmap, target, signal)

  if (!ignoreExifOrientation) {
    const orientation = getOrientationFromExif(meta?.exif)
    const needsTransform =
      orientation.state === 'valid' &&
      (orientation.degrees !== 0 || orientation.mirrored)
    if (needsTransform) {
      bitmap = await applyOrientationToImageBitmap(bitmap, orientation)
      throwIfBitmapDecodeAborted(signal, [bitmap])
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height

  const renderer = canvas.getContext('bitmaprenderer')
  if (!renderer) {
    bitmap.close()
    throw new Error('Failed to get bitmaprenderer context')
  }

  renderer.transferFromImageBitmap(bitmap)
  return canvas
}

export function clearCanvasElement(canvas: HTMLCanvasElement): void {
  canvas.width = 0
  canvas.height = 0
}
