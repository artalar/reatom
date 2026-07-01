export type ThumbnailSlotPriority = 'high' | 'background'

export const maxParallelThumbnails = Math.max(
  2,
  (globalThis.navigator?.hardwareConcurrency ?? 4) * 2,
)

type ThumbnailQueueEntry = {
  priority: ThumbnailSlotPriority
  cancelled: boolean
  grant: () => void
  reject: (error: Error) => void
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
): Promise<() => void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createThumbnailAbortError(signal))
      return
    }

    let granted = false
    let released = false

    const release = () => {
      if (!granted || released) return
      released = true
      signal.removeEventListener('abort', abort)
      releaseThumbnailSlot()
    }

    const entry: ThumbnailQueueEntry = {
      priority,
      cancelled: false,
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
      entry.reject(createThumbnailAbortError(signal))
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

const shutdownError = new Error('Thumbnail queue shut down')

export function shutdownThumbnailQueue(): void {
  while (thumbnailQueue.length > 0) {
    const entry = thumbnailQueue.shift()
    if (!entry || entry.cancelled) continue
    entry.cancelled = true
    entry.reject(shutdownError)
  }

  activeThumbnailJobs = 0
}
