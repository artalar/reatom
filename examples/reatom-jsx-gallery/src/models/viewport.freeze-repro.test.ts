import { effect, sleep } from '@reatom/core'
import { expect, test } from 'vitest'

import { viewportSize } from './viewport'

test('viewportSize is referentially stable between reads', () => {
  const first = viewportSize()
  const second = viewportSize()
  expect(second).toBe(first)
})

test('a single effect reading viewportSize settles', async () => {
  let runs = 0
  const watcher = effect(() => {
    runs += 1
    viewportSize()
  }, 'test.viewportWatcherSingle')

  await sleep(200)
  watcher.unsubscribe()

  expect(runs).toBeLessThan(5)
})

test('two effects reading viewportSize settle instead of ping-ponging', async () => {
  let runsA = 0
  let runsB = 0
  const watcherA = effect(() => {
    runsA += 1
    viewportSize()
  }, 'test.viewportWatcherA')
  const watcherB = effect(() => {
    runsB += 1
    viewportSize()
  }, 'test.viewportWatcherB')

  await sleep(200)
  watcherA.unsubscribe()
  watcherB.unsubscribe()

  expect(runsA + runsB).toBeLessThan(10)
})
