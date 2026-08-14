/**
 * Full-size photo decodes are serialized because Chrome rejects concurrent
 * `img.decode()` calls with `EncodingError` when the decoded frames do not fit
 * the image cache (a 50+ megapixel photo takes ~200MB decoded). That error is
 * indistinguishable from a genuinely broken file, so concurrency must be
 * avoided instead of handled after the fact.
 */

type DecodeQueueEntry = {
  cancelled: boolean
  grant: () => void
  cancel: (error: Error) => void
}

const decodeQueue: DecodeQueueEntry[] = []
let activeDecodeJobs = 0

const maxParallelImageDecodes = 1

type DecodeSlotLease = {
  start: () => void
  release: () => void
}

function createDecodeAbortError(signal: AbortSignal): Error {
  if (signal.reason instanceof Error) return signal.reason

  const error = new Error(String(signal.reason ?? 'image decode aborted'))
  error.name = 'AbortError'
  return error
}

function runNextDecodeJob() {
  while (activeDecodeJobs < maxParallelImageDecodes && decodeQueue.length > 0) {
    const entry = decodeQueue.shift()
    if (!entry) return
    if (entry.cancelled) continue

    activeDecodeJobs += 1
    entry.grant()
  }
}

export function acquireImageDecodeSlot(
  signal: AbortSignal,
): Promise<DecodeSlotLease> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createDecodeAbortError(signal))
      return
    }

    let granted = false
    let started = false
    let released = false

    const release = () => {
      if (!granted || released) return
      released = true
      signal.removeEventListener('abort', abort)
      releaseImageDecodeSlot()
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

    const entry: DecodeQueueEntry = {
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

      entry.cancel(createDecodeAbortError(signal))
    }

    signal.addEventListener('abort', abort, { once: true })
    decodeQueue.push(entry)
    runNextDecodeJob()
  })
}

function releaseImageDecodeSlot() {
  activeDecodeJobs = Math.max(0, activeDecodeJobs - 1)
  runNextDecodeJob()
}

export function shutdownImageDecodeQueue(): void {
  while (decodeQueue.length > 0) {
    const entry = decodeQueue.shift()
    if (!entry || entry.cancelled) continue
    const error = new Error('Image decode queue shut down')
    error.name = 'AbortError'
    entry.cancel(error)
  }
}
