import { atom } from '@reatom/core'
import { expect, test } from 'test'

import { ADMIN_FRAME } from '../root'
import type { AdminFrame } from '../types'
import { createTimelineManager } from './index'

function makeFrame(overrides: Partial<AdminFrame> = {}): AdminFrame {
  return {
    id: 1,
    timestamp: 1000,
    sessionId: 's1',
    atomId: 'a1',
    state: 42,
    error: null,
    params: undefined,
    payload: undefined,
    pubIds: [],
    ...overrides,
  }
}

test('buckets group frames by time intervals', () => {
  const framesAtom = atom([
    makeFrame({ id: 1, timestamp: 100 }),
    makeFrame({ id: 2, timestamp: 150 }),
    makeFrame({ id: 3, timestamp: 250 }),
  ])
  const timeline = ADMIN_FRAME.run(() =>
    createTimelineManager({ frames: () => framesAtom() }),
  )
  ADMIN_FRAME.run(() => {
    timeline.bucketSize.set(100)
    timeline.zoom.set(1)
    const buckets = timeline.buckets()
    expect(buckets.length).toBeGreaterThanOrEqual(1)
    const first = buckets[0]!
    expect(first.entries.length).toBeGreaterThanOrEqual(2)
    expect(first.start).toBeLessThanOrEqual(100)
  })
})

test('zoom changes bucket granularity', () => {
  const framesAtom = atom([
    makeFrame({ timestamp: 100 }),
    makeFrame({ id: 2, timestamp: 200 }),
  ])
  const timeline = ADMIN_FRAME.run(() =>
    createTimelineManager({ frames: () => framesAtom() }),
  )
  ADMIN_FRAME.run(() => {
    timeline.bucketSize.set(50)
    timeline.zoom.set(1)
    const buckets1 = timeline.buckets()
    timeline.zoom.set(2)
    const buckets2 = timeline.buckets()
    expect(buckets2.length).not.toBe(buckets1.length)
  })
})

test('offset filters visible buckets to the panned time window', () => {
  const framesAtom = atom([
    makeFrame({ id: 1, timestamp: 0 }),
    makeFrame({ id: 2, timestamp: 100 }),
    makeFrame({ id: 3, timestamp: 200 }),
    makeFrame({ id: 4, timestamp: 300 }),
  ])
  const timeline = ADMIN_FRAME.run(() =>
    createTimelineManager({ frames: () => framesAtom() }),
  )

  ADMIN_FRAME.run(() => {
    timeline.bucketSize.set(100)
    timeline.zoom.set(1)
    timeline.offset.set(0)
    expect(timeline.visibleBuckets().length).toBe(timeline.buckets().length)

    timeline.offset.set(0.5)
    expect(timeline.visibleBuckets().length).toBeLessThan(
      timeline.buckets().length,
    )
  })
})

test('frameGroups clusters by timestamp', () => {
  const framesAtom = atom([
    makeFrame({ id: 1, timestamp: 100 }),
    makeFrame({ id: 2, timestamp: 100 }),
    makeFrame({ id: 3, timestamp: 200 }),
  ])
  const timeline = ADMIN_FRAME.run(() =>
    createTimelineManager({ frames: () => framesAtom() }),
  )
  ADMIN_FRAME.run(() => {
    const groups = timeline.frameGroups()
    expect(groups.length).toBe(2)
    const ts100 = groups.find((g) => g.timestamp === 100)
    expect(ts100).toBeDefined()
    expect(ts100!.frames.length).toBe(2)
  })
})
