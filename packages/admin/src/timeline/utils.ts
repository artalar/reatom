import type { AdminFrame } from '../types'

const MIN_BUCKET_SIZE_MS = 50
const MAX_BUCKET_SIZE_MS = 2000
const TARGET_BURST_COUNT = 10

export function computeSuggestedBucketSize(frames: Array<AdminFrame>): number {
  if (frames.length === 0) return 100

  const minTimestamp = Math.min(...frames.map((frame) => frame.timestamp))
  const maxTimestamp = Math.max(...frames.map((frame) => frame.timestamp))
  const durationMs = Math.max(maxTimestamp - minTimestamp, 1)

  return Math.min(
    MAX_BUCKET_SIZE_MS,
    Math.max(MIN_BUCKET_SIZE_MS, Math.ceil(durationMs / TARGET_BURST_COUNT)),
  )
}

export function formatSessionDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.max(1, Math.round(durationMs))}ms`
  }

  if (durationMs < 60_000) {
    const seconds = durationMs / 1000
    return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
  }

  const minutes = Math.floor(durationMs / 60_000)
  const seconds = Math.round((durationMs % 60_000) / 1000)
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}
