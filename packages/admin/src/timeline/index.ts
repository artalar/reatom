import { atom, computed } from '@reatom/core'

import { ADMIN_FRAME } from '../root'
import type { AdminFrame } from '../types'

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

export function createTimeline(deps: TimelineDeps) {
  const bucketSize = atom(100, `${PREFIX}.bucketSize`)
  const zoom = atom(1, `${PREFIX}.zoom`)
  const offset = atom(0, `${PREFIX}.offset`)

  const buckets = computed((): TimeBucket[] => {
    const frames = deps.frames()
    const size = bucketSize() * zoom()
    if (frames.length === 0) return []
    const min = Math.min(...frames.map((f) => f.timestamp))
    const max = Math.max(...frames.map((f) => f.timestamp))
    const range = max - min || 1
    const numBuckets = Math.ceil(range / size) || 1
    const result: TimeBucket[] = []
    for (let i = 0; i < numBuckets; i++) {
      const start = min + i * size
      const end = start + size
      const entries = frames.filter(
        (f) => f.timestamp >= start && f.timestamp < end,
      )
      const errorCount = entries.filter((f) => f.error !== null).length
      const atoms = new Set(entries.map((f) => f.atomId))
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
  }, `${PREFIX}.buckets`)

  const visibleRange = computed((): [number, number] => {
    const frames = deps.frames()
    if (frames.length === 0) return [0, 0]
    const min = Math.min(...frames.map((f) => f.timestamp))
    const max = Math.max(...frames.map((f) => f.timestamp))
    const off = offset()
    const range = max - min
    return [min + off * range, max + off * range]
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

  const frameGroups = computed((): FrameGroup[] => {
    const frames = deps.frames()
    const byTs = new Map<number, AdminFrame[]>()
    for (const f of frames) {
      const list = byTs.get(f.timestamp) ?? []
      list.push(f)
      byTs.set(f.timestamp, list)
    }
    return Array.from(byTs.entries())
      .map(([timestamp, frames]) => ({ timestamp, frames }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, `${PREFIX}.frameGroups`)

  return {
    bucketSize,
    zoom,
    offset,
    buckets,
    visibleBuckets,
    visibleRange,
    frameGroups,
  }
}

export function createTimelineManager(deps: TimelineDeps) {
  return ADMIN_FRAME.run(() => createTimeline(deps))
}
