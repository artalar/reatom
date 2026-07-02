import type LibRaw from 'libraw-wasm'

import {
  getOrientationFromExif,
  orientationDegrees,
  orientationMirrored,
} from '../orientation'
import type { ExifData, RawImageFormat } from '../types'
import type { RawEncodeRequest, RawEncodeResponse } from './rawDevelop.types'
import RawDevelopEncodeWorker from './rawDevelop.worker?worker'

export type RawDevelopResult = {
  blob: Blob
  width: number
  height: number
}

type LibRawModule = { default: typeof LibRaw }
type LibRawInstance = LibRaw

type LibRawImageData = {
  width: number
  height: number
  colors: number
  bits: number
  data: Uint8Array
  dataSize: number
}

type DevelopOrientation = {
  degrees: number
  mirrored: boolean
}

type DevelopSlot = {
  instance: LibRawInstance | null
  abort: AbortController | null
}

type DevelopJob = {
  source: Blob
  orientation: DevelopOrientation
  externalSignal: AbortSignal | undefined
  maxDimension?: number
  resolve: (result: RawDevelopResult | null) => void
  reject: (error: Error) => void
  releaseQueueAbort?: () => void
}

const JPEG_DEVELOP_QUALITY = 0.92
const DEVELOP_POOL_SIZE = 3

let libRawModulePromise: Promise<LibRawModule> | null = null
let developPool: DevelopSlot[] | null = null

const pendingDevelopJobs: DevelopJob[] = []

function loadLibRawModule(): Promise<LibRawModule> {
  if (!libRawModulePromise) {
    libRawModulePromise = import('libraw-wasm')
  }
  return libRawModulePromise
}

function ensurePool(_LibRaw: LibRawModule['default']): DevelopSlot[] {
  if (!developPool) {
    developPool = Array.from({ length: DEVELOP_POOL_SIZE }, () => ({
      instance: null,
      abort: null,
    }))
  }
  return developPool
}

function disposeSlotInstance(slot: DevelopSlot): void {
  const instance = slot.instance
  if (!instance) return

  if (typeof instance.dispose === 'function') {
    instance.dispose()
  } else {
    instance.worker.terminate()
  }
  slot.instance = null
}

function createAbortError(): DOMException {
  return new DOMException('Raw develop aborted', 'AbortError')
}

function raceAbort<T>(task: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(createAbortError())
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(createAbortError())
    signal.addEventListener('abort', onAbort, { once: true })
    task.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

let encodeWorker: Worker | null = null
let nextEncodeId = 1
const pendingEncodes = new Map<
  number,
  { resolve: (blob: Blob) => void; reject: (error: Error) => void }
>()

function getEncodeWorker(): Worker {
  if (!encodeWorker) {
    const worker = new RawDevelopEncodeWorker()
    worker.addEventListener(
      'message',
      (event: MessageEvent<RawEncodeResponse>) => {
        const pending = pendingEncodes.get(event.data.id)
        if (!pending) return
        pendingEncodes.delete(event.data.id)
        if ('error' in event.data) {
          pending.reject(new Error(event.data.error))
        } else {
          pending.resolve(event.data.blob)
        }
      },
    )
    encodeWorker = worker
  }
  return encodeWorker
}

function shutdownEncodeWorker(): void {
  for (const pending of pendingEncodes.values()) {
    pending.reject(createAbortError())
  }
  pendingEncodes.clear()
  encodeWorker?.terminate()
  encodeWorker = null
}

function encodeRgbToJpeg(
  rgb: Uint8Array,
  width: number,
  height: number,
  orientation: DevelopOrientation,
  signal: AbortSignal,
  maxDimension?: number,
): Promise<Blob> {
  const worker = getEncodeWorker()
  const id = nextEncodeId++
  const buffer = rgb.buffer as ArrayBuffer

  return new Promise<Blob>((resolve, reject) => {
    if (signal.aborted) {
      reject(createAbortError())
      return
    }

    const onAbort = () => {
      pendingEncodes.delete(id)
      reject(createAbortError())
    }
    signal.addEventListener('abort', onAbort, { once: true })

    pendingEncodes.set(id, {
      resolve: (blob) => {
        signal.removeEventListener('abort', onAbort)
        resolve(blob)
      },
      reject: (error) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    })

    const request: RawEncodeRequest = {
      id,
      rgb: buffer,
      width,
      height,
      quality: JPEG_DEVELOP_QUALITY,
      degrees: orientation.degrees,
      mirrored: orientation.mirrored,
      maxDimension,
    }
    worker.postMessage(request, [buffer])
  })
}

function isLibRawImageData(value: unknown): value is LibRawImageData {
  if (!value || typeof value !== 'object') return false
  const candidate = value as LibRawImageData
  return (
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    candidate.data instanceof Uint8Array &&
    candidate.width > 0 &&
    candidate.height > 0
  )
}

function copyRgbBuffer(image: LibRawImageData): Uint8Array | null {
  const colorCount = image.colors > 0 ? image.colors : 3
  const expectedLength = image.width * image.height * colorCount
  const availableLength = Math.min(image.dataSize, image.data.byteLength)
  if (availableLength < expectedLength) return null
  if (colorCount !== 3) return null

  return new Uint8Array(image.data.subarray(0, expectedLength))
}

function resolveDevelopOrientation(
  exif: ExifData | undefined,
  ignoreOrientation: boolean,
): DevelopOrientation {
  if (ignoreOrientation) return { degrees: 0, mirrored: false }
  const parsed = getOrientationFromExif(exif)
  if (parsed.state !== 'valid') return { degrees: 0, mirrored: false }
  return {
    degrees: orientationDegrees(parsed.value),
    mirrored: orientationMirrored(parsed.value),
  }
}

async function developInSlot(
  slot: DevelopSlot,
  signal: AbortSignal,
  job: DevelopJob,
): Promise<RawDevelopResult | null> {
  const { default: LibRaw } = await loadLibRawModule()
  const instance = new LibRaw()
  slot.instance = instance

  const fileBytes = new Uint8Array(
    await raceAbort(job.source.arrayBuffer(), signal),
  )

  await raceAbort(
    instance.open(fileBytes, {
      useCameraWb: true,
      useCameraMatrix: 1,
      outputColor: 1,
      outputBps: 8,
      userQual: 3,
      halfSize: false,
      userFlip: 0,
    }),
    signal,
  )

  const image = await raceAbort(instance.imageData(), signal)
  if (!isLibRawImageData(image)) return null

  const rgb = copyRgbBuffer(image)
  if (!rgb) return null

  const blob = await encodeRgbToJpeg(
    rgb,
    image.width,
    image.height,
    job.orientation,
    signal,
    job.maxDimension,
  )

  const swapDimensions =
    job.orientation.degrees === 90 || job.orientation.degrees === 270
  const developedWidth = swapDimensions ? image.height : image.width
  const developedHeight = swapDimensions ? image.width : image.height
  const outputLongEdge = Math.max(developedWidth, developedHeight)
  const cappedLongEdge = job.maxDimension
    ? Math.min(outputLongEdge, job.maxDimension)
    : outputLongEdge
  const outputScale =
    outputLongEdge > 0 ? cappedLongEdge / outputLongEdge : 1

  return {
    blob,
    width: Math.max(1, Math.round(developedWidth * outputScale)),
    height: Math.max(1, Math.round(developedHeight * outputScale)),
  }
}

function takeNextDevelopJob(): DevelopJob | null {
  while (pendingDevelopJobs.length > 0) {
    const job = pendingDevelopJobs.shift()!
    job.releaseQueueAbort?.()

    // An `abort` listener added to an already-aborted signal never fires, so
    // stale jobs must be rejected here instead of occupying a develop slot.
    if (job.externalSignal?.aborted) {
      job.reject(createAbortError())
      continue
    }

    return job
  }
  return null
}

function scheduleDevelopJobs(): void {
  if (!developPool) return

  for (const [slotIndex, slot] of developPool.entries()) {
    if (slot.abort !== null) continue

    const job = takeNextDevelopJob()
    if (!job) return

    void runDevelopJob(slotIndex, job)
  }
}

async function runDevelopJob(slotIndex: number, job: DevelopJob): Promise<void> {
  const pool = developPool
  if (!pool) {
    job.reject(new Error('Raw develop pool is not available'))
    return
  }

  const slot = pool[slotIndex]!
  const abort = new AbortController()
  slot.abort = abort

  const onExternalAbort = () => {
    if (slot.abort === abort) {
      abort.abort()
    }
  }
  job.externalSignal?.addEventListener('abort', onExternalAbort, { once: true })

  try {
    const result = await developInSlot(slot, abort.signal, job)
    job.resolve(result)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      job.reject(error)
      return
    }
    job.reject(error instanceof Error ? error : new Error(String(error)))
  } finally {
    job.externalSignal?.removeEventListener('abort', onExternalAbort)
    if (slot.abort === abort) {
      slot.abort = null
      disposeSlotInstance(slot)
    }
    scheduleDevelopJobs()
  }
}

function enqueueDevelopJob(job: DevelopJob): void {
  if (job.externalSignal?.aborted) {
    job.reject(createAbortError())
    return
  }

  const { externalSignal } = job
  if (externalSignal) {
    const dropFromQueue = () => {
      const index = pendingDevelopJobs.indexOf(job)
      if (index !== -1) {
        pendingDevelopJobs.splice(index, 1)
        job.reject(createAbortError())
      }
    }
    externalSignal.addEventListener('abort', dropFromQueue, { once: true })
    job.releaseQueueAbort = () =>
      externalSignal.removeEventListener('abort', dropFromQueue)
  }

  pendingDevelopJobs.push(job)
  scheduleDevelopJobs()
}

async function developWithPool(
  source: Blob,
  orientation: DevelopOrientation,
  externalSignal: AbortSignal | undefined,
  maxDimension?: number,
): Promise<RawDevelopResult | null> {
  const { default: LibRaw } = await loadLibRawModule()
  ensurePool(LibRaw)

  return new Promise<RawDevelopResult | null>((resolve, reject) => {
    enqueueDevelopJob({
      source,
      orientation,
      externalSignal,
      maxDimension,
      resolve,
      reject,
    })
  })
}

export function isRawDevelopSupported(): boolean {
  return (
    typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof crossOriginIsolated !== 'undefined' &&
    crossOriginIsolated
  )
}

export function shutdownRawDevelopPool(): void {
  while (pendingDevelopJobs.length > 0) {
    const job = pendingDevelopJobs.shift()
    job?.releaseQueueAbort?.()
    job?.reject(createAbortError())
  }

  if (developPool) {
    for (const slot of developPool) {
      slot.abort?.abort()
      slot.abort = null
      disposeSlotInstance(slot)
    }
    developPool = null
  }

  shutdownEncodeWorker()
}

export async function developRawToJpegBlob(
  source: Blob,
  options?: {
    format?: RawImageFormat
    exif?: ExifData
    ignoreOrientation?: boolean
    maxDimension?: number
    signal?: AbortSignal
  },
): Promise<RawDevelopResult | null> {
  if (!isRawDevelopSupported()) return null

  const orientation = resolveDevelopOrientation(
    options?.exif,
    options?.ignoreOrientation ?? false,
  )

  try {
    return await developWithPool(
      source,
      orientation,
      options?.signal,
      options?.maxDimension,
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }
    console.error('RAW develop failed:', error)
    return null
  }
}
