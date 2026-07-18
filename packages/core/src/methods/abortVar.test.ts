import { expect, test } from 'test'

import { race } from './abortVar'

const controlledPromise = <T>(promise: Promise<T>) =>
  Object.assign(promise, { controller: new AbortController() })

test('race does not abort the settled winner', async () => {
  const winner = controlledPromise(Promise.resolve('winner'))
  const loser = controlledPromise(new Promise<string>(() => {}))

  await expect(race(winner, loser)).resolves.toBe('winner')

  expect(winner.controller.signal.aborted).toBe(false)
  expect(loser.controller.signal.aborted).toBe(true)
})
