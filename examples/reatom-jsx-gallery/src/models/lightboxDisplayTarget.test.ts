import { atom, clearStack, context, wrap } from '@reatom/core'
import { expect, test, vi } from 'vitest'

import {
  createLightboxDisplayTargetDebouncer,
  lightboxDebouncedDisplayTarget,
  resetLightboxDisplayTargetDebouncer,
} from './lightboxDisplayTarget'

test.beforeEach(() => {
  clearStack()
  vi.useFakeTimers()
})

test.afterEach(() => {
  vi.useRealTimers()
})

test('display target updates only after zoom input settles', async () => {
  await context.start(async () => {
    resetLightboxDisplayTargetDebouncer()
    const initial = { width: 800, height: 600, zoom: 1 }
    const zoomed = { width: 1600, height: 1200, zoom: 2 }
    const immediateTarget = atom(initial, 'test.immediateDisplayTarget')
    const stop = createLightboxDisplayTargetDebouncer(() => immediateTarget())

    await wrap(vi.advanceTimersByTimeAsync(0))
    expect(lightboxDebouncedDisplayTarget()).toEqual(initial)

    immediateTarget.set(zoomed)
    await wrap(vi.advanceTimersByTimeAsync(199))
    expect(lightboxDebouncedDisplayTarget()).toEqual(initial)

    await wrap(vi.advanceTimersByTimeAsync(1))
    expect(lightboxDebouncedDisplayTarget()).toEqual(zoomed)
    stop()
  })
})
