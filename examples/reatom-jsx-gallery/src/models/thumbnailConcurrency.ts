export type ThumbnailSlotPriority = 'high' | 'background'

export const maxParallelThumbnails = Math.max(
  2,
  (globalThis.navigator?.hardwareConcurrency ?? 4) * 2,
)

type ThumbnailSlotLease = {
  start: () => void
  release: () => void
}

type ThumbnailQueueEntry = {
  priority: ThumbnailSlotPriority
  cancelled: boolean
  grant: () => void
  cancel: (error: Error) => void
}

const thumbnailQueue: ThumbnailQueueEntry[] = []
let activeThumbnailJobs = 0

const priorityRank: Record<ThumbnailSlotPriority, number> = {
  high: 0,
  background: 1,
}

function createThumbnailAbortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason

  const error = new Error(String(signal.reason ?? 'thumbnail request aborted'))
  error.name = 'AbortError'
  return error
}

function enqueueThumbnailJob(entry: ThumbnailQueueEntry) {
  const insertIndex = thumbnailQueue.findIndex(
    (queued) => priorityRank[queued.priority] > priorityRank[entry.priority],
  )
  if (insertIndex === -1) {
    thumbnailQueue.push(entry)
    return
  }
  thumbnailQueue.splice(insertIndex, 0, entry)
}

function runNextThumbnailJob() {
  while (
    activeThumbnailJobs < maxParallelThumbnails &&
    thumbnailQueue.length > 0
  ) {
    const entry = thumbnailQueue.shift()
    if (!entry) return
    if (entry.cancelled) continue

    activeThumbnailJobs += 1
    entry.grant()
  }
}

export function acquireThumbnailSlot(
  signal: AbortSignal,
  priority: ThumbnailSlotPriority = 'high',
): Promise<ThumbnailSlotLease> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createThumbnailAbortError(signal))
      return
    }

    let granted = false
    let started = false
    let released = false

    const release = () => {
      if (!granted || released) return
      released = true
      signal.removeEventListener('abort', abort)
      releaseThumbnailSlot()
    }

    const start = () => {
      if (!granted || released) return
      started = true
    }

    const cancel = (error: Error) => {
      if (granted || entry.cancelled) return
      entry.cancelled = true
      signal.removeEventListener('abort', abort)
      reject(error)
    }

    const entry: ThumbnailQueueEntry = {
      priority,
      cancelled: false,
      grant: () => {
        granted = true
        resolve({ start, release })
      },
      cancel,
    }

    const abort = () => {
      if (granted) {
        if (!started) release()
        return
      }

      entry.cancel(createThumbnailAbortError(signal))
    }

    signal.addEventListener('abort', abort, { once: true })
    enqueueThumbnailJob(entry)
    runNextThumbnailJob()
  })
}

function releaseThumbnailSlot() {
  activeThumbnailJobs = Math.max(0, activeThumbnailJobs - 1)
  runNextThumbnailJob()
}

export function shutdownThumbnailQueue(): void {
  while (thumbnailQueue.length > 0) {
    const entry = thumbnailQueue.shift()
    if (!entry || entry.cancelled) continue
    const error = new Error('Thumbnail queue shut down')
    error.name = 'AbortError'
    entry.cancel(error)
  }
}
