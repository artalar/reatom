import { afterEach, expect, expectTypeOf, test, vi, viTest } from 'test'

import { atom, context, notify } from '../../core'
import { MAX_SAFE_TIMEOUT } from '../../utils'
import type { PersistRecord } from '../index'
import {
  reatomPersistWebStorage,
  withLocalStorage,
  withSessionStorage,
} from './localStorage'

const uniqueKey = (label: string) =>
  `local-storage-${label}-${Date.now()}-${Math.random()}`

const createRecord = <State>(data: State): PersistRecord<State> => ({
  data,
  id: 0,
  timestamp: Date.now(),
  to: Date.now() + MAX_SAFE_TIMEOUT,
  version: 0,
})

afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
  localStorage.clear()
})

viTest.each([
  {
    storageName: 'localStorage',
    storage: localStorage,
    withStorage: withLocalStorage,
  },
  {
    storageName: 'sessionStorage',
    storage: sessionStorage,
    withStorage: withSessionStorage,
  },
])('basic ($storageName)', ({ storageName, storage, withStorage }) =>
  context.start(() => {
    const key = `test-${storageName}-key`

    storage.setItem(
      key,
      JSON.stringify({
        data: 'test-value',
        id: 1,
        timestamp: Date.now(),
        to: Date.now() + 10000,
        version: 0,
      }),
    )

    const str = atom('', 'str').extend(withStorage(key))

    expect(str()).toBe('test-value')

    str.set('new-value')
    expect(str()).toBe('new-value')

    const persistedValue = storage.getItem(key)
    expect(JSON.parse(persistedValue!).data).toBe('new-value')

    storage.setItem(
      key,
      JSON.stringify({
        data: 'test-value-2',
        id: 2,
        timestamp: Date.now(),
        to: Date.now() + 10000,
        version: 0,
      }),
    )
    expect(str()).not.toBe('test-value-2')
    // TODO
    // withStorage.storageAtom().cache.clear()
    // expect(str()).toBe('test-value-2')
  }),
)

test('storage error handling', () => {
  const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  // Create a mock storage that throws
  const faultyStorage = {
    getItem: vi.fn(() => {
      throw new Error('Storage error')
    }),
    setItem: vi.fn(() => {
      throw new Error('Storage error')
    }),
    removeItem: vi.fn(() => {
      throw new Error('Storage error')
    }),
  } as any

  const withFaultyStorage = reatomPersistWebStorage('faulty', faultyStorage)

  const testAtom = atom(42, 'faultyStorageTestAtom').extend(
    withFaultyStorage('faulty-key'),
  )

  // Should not throw and use default value
  expect(testAtom()).toBe(42)

  // Should not throw when setting
  testAtom.set(100)
  expect(testAtom()).toBe(100)

  // Should have logged warnings
  expect(consoleSpy).toHaveBeenCalled()

  consoleSpy.mockRestore()
})

test('fromSnapshot and toSnapshot', () => {
  const key = 'test-map-key'

  localStorage.setItem(
    key,
    JSON.stringify({
      data: [
        ['a', 1],
        ['b', 2],
      ],
      id: 1,
      timestamp: Date.now(),
      to: Date.now() + 10000,
      version: 0,
    }),
  )

  const mapAtom = atom(new Map<string, number>(), 'mapAtom').extend(
    withLocalStorage({
      key,
      toSnapshot: (map) => Array.from(map.entries()),
      fromSnapshot: (entries) => {
        expectTypeOf(entries).toEqualTypeOf<[string, number][]>()
        return new Map(entries)
      },
    }),
  )

  expect(mapAtom()).toBeInstanceOf(Map)
  expect(mapAtom().get('a')).toBe(1)
  expect(mapAtom().get('b')).toBe(2)

  mapAtom.set(new Map([['c', 3]]))
  expect(mapAtom().get('c')).toBe(3)

  const persistedValue = localStorage.getItem(key)
  expect(JSON.parse(persistedValue!).data).toEqual([['c', 3]])
})

test('localStorage deletion events invalidate subscribers', () => {
  const key = uniqueKey('clear')
  const storedRecord = createRecord('stored')
  localStorage.setItem(key, JSON.stringify(storedRecord))
  const target = atom('initial', 'localStorageClearAtom').extend(
    withLocalStorage(key),
  )
  const unsubscribe = target.subscribe(() => {})
  notify()

  expect(target()).toBe('stored')

  localStorage.removeItem(key)
  globalThis.dispatchEvent(
    new StorageEvent('storage', {
      key,
      oldValue: JSON.stringify(storedRecord),
      newValue: null,
      storageArea: localStorage,
    }),
  )

  unsubscribe()
  expect(target()).toBe('initial')
})

test('localStorage ignores malformed storage events', () => {
  const key = uniqueKey('malformed')
  let storageHandler: ((event: StorageEvent) => void) | undefined
  const originalAddEventListener = globalThis.addEventListener.bind(globalThis)
  vi.spyOn(globalThis, 'addEventListener').mockImplementation(
    (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (listener === null) return
      if (type === 'storage' && typeof listener === 'function') {
        storageHandler = (event) => listener(event)
      }
      return originalAddEventListener(type, listener, options)
    },
  )
  const target = atom('initial', 'localStorageMalformedAtom').extend(
    withLocalStorage(key),
  )
  const unsubscribe = target.subscribe(() => {})
  notify()

  expect(storageHandler).toBeDefined()
  let thrown: unknown
  try {
    storageHandler?.(
      new StorageEvent('storage', {
        key,
        newValue: '{broken',
        storageArea: localStorage,
      }),
    )
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeUndefined()

  unsubscribe()
  expect(target()).toBe('initial')
})
