import { expect, test } from 'test'

import type { AdminFrame } from '../types'
import {
  getFrameExportPayload,
  getFrameInspectorPayload,
  isActionFrame,
} from './frame-inspector'

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

test('frame inspector payload hides action fields for state frames', () => {
  const frame = makeFrame({ state: { ready: true } })

  expect(isActionFrame(frame)).toBe(false)
  expect(getFrameInspectorPayload(frame)).toEqual({ state: { ready: true } })
})

test('frame inspector payload shows action fields only for actions', () => {
  const frame = makeFrame({
    params: [{ id: 1 }],
    payload: { ok: true },
    state: undefined,
  })

  expect(isActionFrame(frame)).toBe(true)
  expect(getFrameInspectorPayload(frame)).toEqual({
    params: [{ id: 1 }],
    payload: { ok: true },
  })
})

test('frame export payload includes error only when present', () => {
  const withoutError = makeFrame()
  const withError = makeFrame({ error: { message: 'boom' } })

  expect(getFrameExportPayload(withoutError)).toEqual({ state: 42 })
  expect(getFrameExportPayload(withError)).toEqual({
    state: 42,
    error: { message: 'boom' },
  })
})
