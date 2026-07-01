import { atom } from '@reatom/core'

export const maxParallelThumbnails = Math.max(
  2,
  (globalThis.navigator?.hardwareConcurrency ?? 4) * 2,
)

export const activeThumbnailRequests = atom(0, 'thumbnail.activeRequests')

type ThumbnailQueueEntry = {
  cancelled: boolean
  grant: () => void
  reject: (error: Error) => void
}

const thumbnailQueue: ThumbnailQueueEntry[] = []
let activeThumbnailJobs = 0

function createThumbnailAbortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason

  const error = new Error(String(signal.reason ?? 'thumbnail request aborted'))
  error.name = 'AbortError'
  return error
}

function syncActiveThumbnailRequests() {
  activeThumbnailRequests.set(activeThumbnailJobs)
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
    syncActiveThumbnailRequests()
    entry.grant()
  }
}

export function acquireThumbnailSlot(signal: AbortSignal): Promise<() => void> {
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
    thumbnailQueue.push(entry)
    runNextThumbnailJob()
  })
}

function releaseThumbnailSlot() {
  activeThumbnailJobs = Math.max(0, activeThumbnailJobs - 1)
  syncActiveThumbnailRequests()
  runNextThumbnailJob()
}
