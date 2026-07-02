import { afterEach, beforeEach, expect, test } from 'test'

import { atom, context } from '../../core'
import { wrap } from '../../methods'
import { withSearchParams } from '../../routing/searchParams'
import { sleep } from '../../utils'
import { urlAtom } from '../../web/url'
import { withLocalStorage } from './localStorage'

const STORAGE_KEY = 'persist-search-params.volume'
const DEFAULT_VOLUME = 0.7

const persistRecord = (data: number) =>
  JSON.stringify({
    data,
    id: 1,
    timestamp: Date.now(),
    to: Date.now() + 10_000,
    version: 0,
  })

const volume = atom(DEFAULT_VOLUME, 'persistSearchParams.volume').extend(
  withLocalStorage(STORAGE_KEY),
  withSearchParams('volume', {
    parse: (value) => (value ? parseFloat(value) : undefined),
    serialize: (value) => (value ?? 0).toFixed(2),
  }),
)

beforeEach(() => {
  context.start(() => {
    urlAtom.routes = {}
    window.history.replaceState({}, '', '/')
    urlAtom.syncFromSource(new URL(window.location.href), true)
  })
})

afterEach(() => {
  localStorage.clear()
})

test('restores saved preference when URL has no volume param', () => {
  localStorage.setItem(STORAGE_KEY, persistRecord(0.42))

  expect(volume()).toBe(0.42)
  expect(urlAtom().searchParams.get('volume')).toBeNull()
})

test('saved preference wins over a shared URL on cold start', async () => {
  localStorage.setItem(STORAGE_KEY, persistRecord(0.42))

  urlAtom.go('/?volume=0.90')

  expect(volume()).toBe(0.42)
})

test('user adjustment syncs to localStorage and URL for shareable state', async () => {
  volume.subscribe()

  volume.set(0.55)

  await wrap(sleep())

  expect(volume()).toBe(0.55)
  expect(urlAtom().searchParams.get('volume')).toBe('0.55')
  expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).data).toBe(0.55)
})
