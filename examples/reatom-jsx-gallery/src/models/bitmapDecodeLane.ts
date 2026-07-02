/**
 * Lane B: sized `createImageBitmap` decodes. These never pin the compositor
 * decode cache, so they can run in parallel with a separate output budget.
 */

type BitmapDecodePriority = 'current' | 'zoom' | 'preload'

type BitmapDecodeQueueEntry = {
  cancelled: boolean
  priority: BitmapDecodePriority
  outputMegapixels: number
  grant: () => void
  reject: (error: Error) => void
}

const priorityRank: Record<BitmapDecodePriority, number> = {
  current: 0,
  zoom: 1,
  preload: 2,
}

const maxParallelBitmapDecodes = 2
const maxInFlightOutputMegapixels = 32

const bitmapDecodeQueue: BitmapDecodeQueueEntry[] = []
let activeBitmapDecodeJobs = 0
let inFlightOutputMegapixels = 0

function createBitmapDecodeAbortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason

  const error = new Error(String(signal.reason ?? 'bitmap decode aborted'))
  error.name = 'AbortError'
  return error
}

function sortBitmapDecodeQueue() {
  bitmapDecodeQueue.sort(
    (left, right) => priorityRank[left.priority] - priorityRank[right.priority],
  )
}

function createPreemptAbortError(): Error {
  const error = new Error('bitmap decode preempted')
  error.name = 'AbortError'
  return error
}

function preemptLowerPriorityJobs(priority: BitmapDecodePriority) {
  if (priority !== 'current') return

  for (const entry of bitmapDecodeQueue) {
    if (entry.cancelled) continue
    if (priorityRank[entry.priority] <= priorityRank.current) continue
    entry.cancelled = true
    entry.reject(createPreemptAbortError())
  }
}

function runNextBitmapDecodeJob() {
  sortBitmapDecodeQueue()

  while (
    activeBitmapDecodeJobs < maxParallelBitmapDecodes &&
    bitmapDecodeQueue.length > 0
  ) {
    const entryIndex = bitmapDecodeQueue.findIndex(
      (entry) =>
        !entry.cancelled &&
        inFlightOutputMegapixels + entry.outputMegapixels <=
          maxInFlightOutputMegapixels,
    )
    if (entryIndex === -1) return

    const entry = bitmapDecodeQueue.splice(entryIndex, 1)[0]
    if (!entry || entry.cancelled) continue

    activeBitmapDecodeJobs += 1
    inFlightOutputMegapixels += entry.outputMegapixels
    entry.grant()
  }
}

export function acquireBitmapDecodeSlot(
  signal: AbortSignal,
  priority: BitmapDecodePriority,
  outputMegapixels: number,
): Promise<() => void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createBitmapDecodeAbortError(signal))
      return
    }

    preemptLowerPriorityJobs(priority)

    let granted = false
    let released = false

    const release = () => {
      if (!granted || released) return
      released = true
      signal.removeEventListener('abort', abort)
      activeBitmapDecodeJobs = Math.max(0, activeBitmapDecodeJobs - 1)
      inFlightOutputMegapixels = Math.max(
        0,
        inFlightOutputMegapixels - outputMegapixels,
      )
      runNextBitmapDecodeJob()
    }

    const entry: BitmapDecodeQueueEntry = {
      cancelled: false,
      priority,
      outputMegapixels,
      grant: () => {
        granted = true
        resolve(release)
      },
      reject,
    }

    const abort = () => {
      if (granted) {
        release()
        return
      }

      entry.cancelled = true
      entry.reject(createBitmapDecodeAbortError(signal))
    }

    signal.addEventListener('abort', abort, { once: true })
    bitmapDecodeQueue.push(entry)
    runNextBitmapDecodeJob()
  })
}

export function shutdownBitmapDecodeQueue(): void {
  while (bitmapDecodeQueue.length > 0) {
    const entry = bitmapDecodeQueue.shift()
    if (!entry || entry.cancelled) continue
    entry.cancelled = true
    const error = new Error('Bitmap decode queue shut down')
    error.name = 'AbortError'
    entry.reject(error)
  }

  activeBitmapDecodeJobs = 0
  inFlightOutputMegapixels = 0
}

export type { BitmapDecodePriority }
