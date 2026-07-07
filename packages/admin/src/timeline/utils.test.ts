import { expect, test } from 'test'

import type { AdminFrame } from '../types'
import { computeSuggestedBucketSize, formatSessionDuration } from './utils'

function makeFrame(timestamp: number): AdminFrame {
  return {
    id: timestamp,
    timestamp,
    sessionId: 's1',
    atomId: 'a1',
    state: timestamp,
    error: null,
    params: undefined,
    payload: undefined,
    pubIds: [],
  }
}

test('computeSuggestedBucketSize targets short sessions', () => {
  const frames = [
    makeFrame(0),
    makeFrame(1200),
    makeFrame(2400),
    makeFrame(3600),
  ]

  expect(computeSuggestedBucketSize(frames)).toBe(360)
})

test('formatSessionDuration renders readable units', () => {
  expect(formatSessionDuration(250)).toBe('250ms')
  expect(formatSessionDuration(4200)).toBe('4.2s')
  expect(formatSessionDuration(65_000)).toBe('1m 5s')
})
