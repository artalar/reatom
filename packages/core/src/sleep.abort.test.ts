import { expect, test, vi } from 'test'

import { atom } from './core'
import { withConnectHook } from './extensions'
import { wrap } from './methods'
import { isAbort, noop, sleep } from './utils'

test('sleep clears its timer when the awaiting frame is aborted', async () => {
  vi.useFakeTimers()

  try {
    let caught: unknown

    const target = atom(0, 'target').extend(
      withConnectHook(async () => {
        try {
          while (true) {
            await wrap(sleep(10 * 60 * 1000))
          }
        } catch (error) {
          caught = error
        }
      }),
    )

    const unsubscribe = target.subscribe(noop)
    await Promise.resolve()

    expect(vi.getTimerCount()).toBe(1)

    unsubscribe()
    // the rejection reaches the catch a few microtasks later
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(isAbort(caught)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})
