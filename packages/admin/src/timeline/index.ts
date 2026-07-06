import { atom, computed, reatomBoolean } from '@reatom/core'

import { ADMIN_FRAME } from '../root'
import type { AdminFrame } from '../types'
import { computeSuggestedBucketSize } from './utils'

const PREFIX = '_Admin.timeline'

export interface TimelineDeps {
  frames: () => AdminFrame[]
}

export interface TimeBucket {
  start: number
  end: number
  entries: AdminFrame[]
  errorCount: number
  actionCount: number
  stateCount: number
}

export interface FrameGroup {
  timestamp: number
  frames: AdminFrame[]
}

export interface TimelineSessionSummary {
  frameCount: number
  start: number
  end: number
  durationMs: number
  errorCount: number
  burstCount: number
}

function buildBuckets(
  frames: Array<AdminFrame>,
  windowSizeMs: number,
): Array<TimeBucket> {
  if (frames.length === 0) return []

  const min = Math.min(...frames.map((frame) => frame.timestamp))
  const max = Math.max(...frames.map((frame) => frame.timestamp))
  const range = max - min || 1
  const numBuckets = Math.ceil(range / windowSizeMs) || 1
  const result: Array<TimeBucket> = []

  for (let index = 0; index < numBuckets; index += 1) {
    const start = min + index * windowSizeMs
    const end = start + windowSizeMs
    const entries = frames.filter(
      (frame) => frame.timestamp >= start && frame.timestamp < end,
    )
    const errorCount = entries.filter((frame) => frame.error !== null).length
    const atoms = new Set(entries.map((frame) => frame.atomId))

    result.push({
      start,
      end,
      entries,
      errorCount,
      actionCount: entries.length,
      stateCount: atoms.size,
    })
  }

  return result
}

export function createTimeline(deps: TimelineDeps) {
  const bucketSize = atom(100, `${PREFIX}.bucketSize`)
  const zoom = atom(1, `${PREFIX}.zoom`)
  const offset = atom(0, `${PREFIX}.offset`)
  const useAutoFit = reatomBoolean(true, `${PREFIX}.useAutoFit`)

  const effectiveBucketSize = computed(() => {
    if (!useAutoFit()) return bucketSize()
    return computeSuggestedBucketSize(deps.frames())
  }, `${PREFIX}.effectiveBucketSize`)

  const sessionSummary = computed((): TimelineSessionSummary => {
    const frames = deps.frames()
    if (frames.length === 0) {
      return {
        frameCount: 0,
        start: 0,
        end: 0,
        durationMs: 0,
        errorCount: 0,
        burstCount: 0,
      }
    }

    const start = Math.min(...frames.map((frame) => frame.timestamp))
    const end = Math.max(...frames.map((frame) => frame.timestamp))
    const errorCount = frames.filter((frame) => frame.error !== null).length
    const burstTimestamps = new Set(frames.map((frame) => frame.timestamp))

    return {
      frameCount: frames.length,
      start,
      end,
      durationMs: Math.max(end - start, 1),
      errorCount,
      burstCount: burstTimestamps.size,
    }
  }, `${PREFIX}.sessionSummary`)

  const buckets = computed((): TimeBucket[] => {
    const windowSizeMs = effectiveBucketSize() * zoom()
    return buildBuckets(deps.frames(), windowSizeMs)
  }, `${PREFIX}.buckets`)

  const visibleRange = computed((): [number, number] => {
    const frames = deps.frames()
    if (frames.length === 0) return [0, 0]

    const min = Math.min(...frames.map((frame) => frame.timestamp))
    const max = Math.max(...frames.map((frame) => frame.timestamp))
    const panOffset = offset()
    const range = max - min

    return [min + panOffset * range, max + panOffset * range]
  }, `${PREFIX}.visibleRange`)

  const visibleBuckets = computed((): TimeBucket[] => {
    const allBuckets = buckets()
    if (allBuckets.length === 0) return []

    const [rangeStart, rangeEnd] = visibleRange()
    if (rangeStart === rangeEnd) return allBuckets

    return allBuckets.filter(
      (bucket) => bucket.end > rangeStart && bucket.start < rangeEnd,
    )
  }, `${PREFIX}.visibleBuckets`)

  const chartBuckets = computed((): TimeBucket[] => {
    return visibleBuckets().filter((bucket) => bucket.entries.length > 0)
  }, `${PREFIX}.chartBuckets`)

  const isPannedOutsideRange = computed(() => {
    return buckets().length > 0 && visibleBuckets().length === 0
  }, `${PREFIX}.isPannedOutsideRange`)

  const busiestChartBucketIndex = computed((): number | null => {
    const chart = chartBuckets()
    if (chart.length === 0) return null

    let busiestIndex = 0
    let busiestCount = chart[0]?.entries.length ?? 0

    chart.forEach((bucket, index) => {
      if (bucket.entries.length > busiestCount) {
        busiestCount = bucket.entries.length
        busiestIndex = index
      }
    })

    return busiestIndex
  }, `${PREFIX}.busiestChartBucketIndex`)

  const frameGroups = computed((): FrameGroup[] => {
    const frames = deps.frames()
    const byTimestamp = new Map<number, AdminFrame[]>()

    for (const frame of frames) {
      const group = byTimestamp.get(frame.timestamp) ?? []
      group.push(frame)
      byTimestamp.set(frame.timestamp, group)
    }

    return Array.from(byTimestamp.entries())
      .map(([timestamp, groupedFrames]) => ({
        timestamp,
        frames: groupedFrames,
      }))
      .sort((left, right) => left.timestamp - right.timestamp)
  }, `${PREFIX}.frameGroups`)

  const prefersEventList = computed(() => {
    const summary = sessionSummary()
    return summary.frameCount > 0 && summary.frameCount < 25
  }, `${PREFIX}.prefersEventList`)

  function applyAutoFit(): void {
    useAutoFit.setTrue()
    bucketSize.set(computeSuggestedBucketSize(deps.frames()))
    zoom.set(1)
    offset.set(0)
  }

  function resetTimeline(): void {
    applyAutoFit()
  }

  return {
    bucketSize,
    zoom,
    offset,
    useAutoFit,
    effectiveBucketSize,
    sessionSummary,
    buckets,
    visibleBuckets,
    chartBuckets,
    visibleRange,
    isPannedOutsideRange,
    busiestChartBucketIndex,
    frameGroups,
    prefersEventList,
    applyAutoFit,
    resetTimeline,
  }
}

export function createTimelineManager(deps: TimelineDeps) {
  return ADMIN_FRAME.run(() => createTimeline(deps))
}

export { computeSuggestedBucketSize, formatSessionDuration } from './utils'
