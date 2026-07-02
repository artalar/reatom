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
  reject: (error: Error) => void
}

const decodeQueue: DecodeQueueEntry[] = []
let activeDecodeJobs = 0

const maxParallelImageDecodes = 1

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
): Promise<() => void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(createDecodeAbortError(signal))
      return
    }

    let granted = false
    let released = false

    const release = () => {
      if (!granted || released) return
      released = true
      signal.removeEventListener('abort', abort)
      releaseImageDecodeSlot()
    }

    const entry: DecodeQueueEntry = {
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
      entry.reject(createDecodeAbortError(signal))
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
    entry.cancelled = true
    const error = new Error('Image decode queue shut down')
    error.name = 'AbortError'
    entry.reject(error)
  }

  activeDecodeJobs = 0
}
