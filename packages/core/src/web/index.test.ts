import { expect, test, vi } from 'test'

import { atom } from '../core'
import { withConnectHook } from '../extensions'
import { wrap } from '../methods'
import { sleep } from '../utils'
import { onEvent, urlAtom } from './'

test('urlAtom work inside node.js', () => {
  expect(() => urlAtom()).not.toThrow()
})

test('onEvent', async () => {
  const a = atom(null)
  const cb = vi.fn()

  const controller = new AbortController()
  a.extend(
    withConnectHook(() => {
      onEvent(controller.signal, 'abort', cb)
    }),
  )
  const un = a.subscribe()
  await wrap(sleep())
  expect(cb).toBeCalledTimes(0)
  controller.abort()
  expect(cb).toBeCalledTimes(1)
  expect(cb.mock.calls[0]?.[0].type).toBe('abort')
  un()
})

test('onEvent abort following', async () => {
  const a = atom(null)
  const cb = vi.fn()

  const controller = new AbortController()
  a.extend(withConnectHook(() => onEvent(controller.signal, 'abort', cb)))
  const un = a.subscribe()
  un()
  await wrap(sleep())
  expect(cb).toBeCalledTimes(0)
  controller.abort()
  expect(cb).toBeCalledTimes(0)
})

test('onEvent removes listeners from structural event dispatchers', () => {
  const cb = vi.fn()
  let listener: ((event: Event) => unknown) | undefined

  const target = {
    addEventListener: (
      _type: string,
      nextListener: (event: Event) => unknown,
    ) => {
      listener = nextListener
    },
    removeEventListener: (
      _type: string,
      nextListener: (event: Event) => unknown,
    ) => {
      if (listener === nextListener) listener = undefined
    },
  }

  const un = onEvent(target, 'change', cb)
  un()

  expect(listener).toBeUndefined()
})
