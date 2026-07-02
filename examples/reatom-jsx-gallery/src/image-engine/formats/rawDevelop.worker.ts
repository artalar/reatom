/// <reference lib="webworker" />

import type { RawEncodeRequest, RawEncodeResponse } from './rawDevelop.types'

function buildRgbaImageData(
  rgb: Uint8Array,
  width: number,
  height: number,
): ImageData {
  const rgba = new Uint8ClampedArray(width * height * 4)
  for (
    let source = 0, target = 0;
    source < rgb.length;
    source += 3, target += 4
  ) {
    rgba[target] = rgb[source] ?? 0
    rgba[target + 1] = rgb[source + 1] ?? 0
    rgba[target + 2] = rgb[source + 2] ?? 0
    rgba[target + 3] = 255
  }
  return new ImageData(rgba, width, height)
}

function rasterizeRgb(rgb: ArrayBuffer, width: number, height: number) {
  const imageData = buildRgbaImageData(new Uint8Array(rgb), width, height)
  const source = new OffscreenCanvas(width, height)
  const sourceContext = source.getContext('2d')
  if (!sourceContext) throw new Error('Failed to get 2D canvas context')
  sourceContext.putImageData(imageData, 0, 0)
  return source
}

function downscaleSourceIfNeeded(
  source: OffscreenCanvas,
  width: number,
  height: number,
  maxDimension?: number,
): OffscreenCanvas {
  if (!maxDimension) return source

  const longEdge = Math.max(width, height)
  if (longEdge <= maxDimension) return source

  const scale = maxDimension / longEdge
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))
  const output = new OffscreenCanvas(targetWidth, targetHeight)
  const context = output.getContext('2d')
  if (!context) return source
  context.drawImage(source, 0, 0, targetWidth, targetHeight)
  return output
}

async function encodeOrientedJpeg(request: RawEncodeRequest): Promise<Blob> {
  const { rgb, width, height, quality, degrees, mirrored, maxDimension } =
    request
  const source = downscaleSourceIfNeeded(
    rasterizeRgb(rgb, width, height),
    width,
    height,
    maxDimension,
  )
  const sourceWidth = source.width
  const sourceHeight = source.height

  const needsOrientation = degrees !== 0 || mirrored
  if (!needsOrientation) {
    return source.convertToBlob({ type: 'image/jpeg', quality })
  }

  const swapDimensions = degrees === 90 || degrees === 270
  const canvasWidth = swapDimensions ? sourceHeight : sourceWidth
  const canvasHeight = swapDimensions ? sourceWidth : sourceHeight

  const output = new OffscreenCanvas(canvasWidth, canvasHeight)
  const context = output.getContext('2d')
  if (!context) throw new Error('Failed to get 2D canvas context')

  context.translate(canvasWidth / 2, canvasHeight / 2)
  if (degrees !== 0) context.rotate((degrees * Math.PI) / 180)
  if (mirrored) context.scale(-1, 1)
  context.drawImage(source, -sourceWidth / 2, -sourceHeight / 2)

  return output.convertToBlob({ type: 'image/jpeg', quality })
}

globalThis.addEventListener(
  'message',
  async (event: MessageEvent<RawEncodeRequest>) => {
    const { id } = event.data
    let response: RawEncodeResponse
    try {
      const blob = await encodeOrientedJpeg(event.data)
      response = { id, blob }
    } catch (error) {
      response = {
        id,
        error: error instanceof Error ? error.message : String(error),
      }
    }
    globalThis.postMessage(response)
  },
)
