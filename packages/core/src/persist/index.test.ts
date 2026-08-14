import { afterEach, describe, expect, subscribe, test, vi } from 'test'

import { wrap } from '..'
import { action, atom, notify } from '../core'
import { withComputed } from '../extensions'
import { MAX_SAFE_TIMEOUT, noop, random, sleep } from '../utils'
import { createMemStorage, type PersistRecord, reatomPersist } from './'

const withSomePersist = reatomPersist(createMemStorage({ name: 'somePersist' }))

const createRecord = <State>(
  data: State,
  overrides: Partial<PersistRecord<State>> = {},
): PersistRecord<State> => ({
  data,
  id: 0,
  timestamp: Date.now(),
  to: Date.now() + MAX_SAFE_TIMEOUT,
  version: 0,
  ...overrides,
})

afterEach(() => vi.restoreAllMocks())

describe('base', () => {
  test('should persist and update state correctly', async () => {
    withSomePersist.storageAtom.set(
      createMemStorage({
        name: 'test',
        snapshot: {
          a1: 1,
          a2: 2,
        },
      }),
    )

    const a1 = atom(0).extend(withSomePersist('a1'))
    const a2 = atom(0).extend(withSomePersist('a2'))

    expect(a1()).toBe(1)
    expect(a2()).toBe(2)

    a1.set(11)
    expect(a1()).toBe(11)
    expect(a2()).toBe(2)

    const storage = withSomePersist.storageAtom()
    expect((await wrap(storage.get({ key: 'a1' })))?.data).toBe(11)

    a1.set(12)
    a1.set((state) => (state ? state : state))
    expect(a1()).toBe(12)
    expect((await wrap(storage.get({ key: 'a1' })))?.data).toBe(12)
  })

  // test('should persist and update cache atom correctly', async () => {
  //   const ctx = createTestCtx()
  //   const resource = reatomResource(async () => 1, 'resource').pipe(
  //     withDataAtom(),
  //     withCache({ withPersist: withSomePersist })
  //   )

  //   withSomePersist.storageAtom(
  //     ctx,
  //     createMemStorage({
  //       name: 'test',
  //       snapshot: {
  //         [resource.cacheAtom.__reatom.name!]: [
  //           [
  //             [],
  //             {
  //               value: 1,
  //               version: 1,
  //               params: [],
  //               clearTimeoutId: 0,
  //               controller: {},
  //               lastUpdate: Date.now(),
  //             }
  //           ]
  //         ]
  //       },
  //     }),
  //   )

  //   expect(ctx.get(resource.dataAtom)).toBe(1)

  //   withSomePersist.storageAtom(
  //     ctx,
  //     createMemStorage({
  //       name: 'test',
  //       snapshot: {
  //         [resource.cacheAtom.__reatom.name!]: [
  //           [
  //             [],
  //             {
  //               value: 2,
  //               version: 1,
  //               params: [],
  //               clearTimeoutId: 0,
  //               controller: {},
  //               lastUpdate: Date.now(),
  //             }
  //           ]
  //         ]
  //       },
  //     }),
  //   )

  //   expect(ctx.get(resource.dataAtom)).toBe(2)
  // })
})

describe('async', () => {
  const expectAsyncStorageErrorToBeHandled = async (
    operation: 'get' | 'set' | 'clear',
  ) => {
    const error = new Error(`${operation} failed`)
    const storage = reatomPersist<string>({
      name: 'failingAsyncStorage',
      get: () =>
        operation === 'get' ? Promise.reject(error) : Promise.resolve(null),
      set: () =>
        operation === 'set' ? Promise.reject(error) : Promise.resolve(),
      clear: () =>
        operation === 'clear' ? Promise.reject(error) : Promise.resolve(),
    }).storageAtom()
    const warn = vi.spyOn(console, 'warn').mockImplementation(noop)
    const log = vi.spyOn(console, 'log').mockImplementation(noop)

    if (operation === 'get') storage.get({ key: 'test' })
    if (operation === 'set') storage.set({ key: 'test' }, createRecord('test'))
    if (operation === 'clear') storage.clear?.({ key: 'test' })

    await wrap(sleep())

    expect(warn).toHaveBeenCalledWith('Error in storage failingAsyncStorage')
    expect(log).toHaveBeenCalledWith(error)
  }

  test.each(['get', 'set', 'clear'] as const)(
    'handles an async storage %s rejection',
    expectAsyncStorageErrorToBeHandled,
  )

  test('should handle async updates', async () => {
    let trigger = noop
    const number1Atom = atom(0).extend(withSomePersist({ key: 'test' }))
    const number2Atom = atom(0).extend(withSomePersist({ key: 'test' }))

    const storage = withSomePersist.storageAtom()
    withSomePersist.storageAtom.set({
      ...storage,
      async set(options, rec) {
        await wrap(new Promise((resolve) => (trigger = resolve)))
        storage.set(options, rec)
      },
    })

    const track = subscribe(number2Atom)
    track.mockClear()

    expect(number1Atom()).toBe(0)
    expect(number2Atom()).toBe(0)

    number1Atom.set(11)
    expect(number1Atom()).toBe(11)
    expect(number2Atom()).toBe(0)
    expect(track).toBeCalledTimes(0)
    await wrap(sleep())
    expect(number2Atom()).toBe(0)
    expect(track).toBeCalledTimes(0)

    trigger()
    await wrap(sleep())

    expect(track).toBeCalledTimes(1)
    expect(track).toBeCalledWith(11)
  })

  test('async storage caches missing records without revalidation loop', async () => {
    let getCalls = 0
    const stableNullPromise = Promise.resolve(null)
    const withAsyncPersist = reatomPersist<string>({
      name: 'auditAsyncMissingStorage',
      get: () => {
        getCalls++
        if (getCalls > 3) return null
        return getCalls === 1 ? Promise.resolve(null) : stableNullPromise
      },
      set: vi.fn(),
      subscribe: () => noop,
    })

    const target = atom('initial', 'auditAsyncMissingAtom').extend(
      withAsyncPersist('missing-key'),
    )
    const unsubscribe = target.subscribe(() => {})

    expect(target()).toBe('initial')
    await wrap(sleep())

    unsubscribe()
    expect(getCalls).toBe(1)
  })

  test('async storage treats expired records as cacheable misses', async () => {
    let getCalls = 0
    const expiredRecord = createRecord('expired', { to: Date.now() - 1 })
    const stableExpiredPromise = Promise.resolve(expiredRecord)
    const withAsyncPersist = reatomPersist<string>({
      name: 'auditAsyncExpiredStorage',
      get: () => {
        getCalls++
        if (getCalls > 3) return expiredRecord
        return getCalls === 1
          ? Promise.resolve(expiredRecord)
          : stableExpiredPromise
      },
      set: vi.fn(),
      subscribe: () => noop,
    })

    const target = atom('initial', 'auditAsyncExpiredAtom').extend(
      withAsyncPersist('expired-key'),
    )
    const unsubscribe = target.subscribe(() => {})

    expect(target()).toBe('initial')
    await wrap(sleep())

    unsubscribe()
    expect(target()).toBe('initial')
    expect(getCalls).toBe(1)
  })

  test('async storage caches rejected reads without revalidation loop', async () => {
    let getCalls = 0
    let rejectGet!: (reason?: unknown) => void
    const error = new Error('get failed')
    const withAsyncPersist = reatomPersist<string>({
      name: 'auditAsyncRejectedStorage',
      get: () => {
        getCalls++
        return new Promise<null>((_resolve, reject) => {
          rejectGet = reject
        })
      },
      set: vi.fn(),
      subscribe: () => noop,
    })
    const target = atom('initial', 'auditAsyncRejectedAtom').extend(
      withAsyncPersist('rejected-key'),
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(noop)
    const log = vi.spyOn(console, 'log').mockImplementation(noop)
    const unsubscribe = target.subscribe(() => {})

    rejectGet(error)
    await wrap(sleep())

    unsubscribe()
    expect(getCalls).toBe(1)
    expect(warn).toHaveBeenCalledWith(
      'Error in storage auditAsyncRejectedStorage',
    )
    expect(log).toHaveBeenCalledWith(error)
  })

  test('subscribe false applies async persisted value on init', async () => {
    const withAsyncPersist = reatomPersist<string>({
      name: 'auditAsyncInitStorage',
      get: () => Promise.resolve(createRecord('stored')),
      set: vi.fn(),
    })

    const target = atom('initial', 'auditAsyncInitAtom').extend(
      withAsyncPersist({
        key: 'async-init-key',
        subscribe: false,
      }),
    )

    expect(target()).toBe('initial')
    await wrap(sleep())
    expect(target()).toBe('stored')
  })
})

describe('should not skip double update', () => {
  test('should persist and update state correctly', async () => {
    withSomePersist.storageAtom.set(
      createMemStorage({
        name: 'test',
        snapshot: {
          a1: 1,
          a2: 2,
        },
      }),
    )

    const a1 = atom(0).extend(withSomePersist('a1'))
    const a2 = atom(0).extend(withSomePersist('a2'))

    expect(a1()).toBe(1)
    expect(a2()).toBe(2)

    a1.set(11)
    expect(a1()).toBe(11)
    expect(a2()).toBe(2)
  })
})

describe('should memoize a computer', () => {
  test('should compute and memoize correctly', () => {
    const storage = withSomePersist.storageAtom.set(
      createMemStorage({
        name: 'test',
        snapshot: {
          a: 1,
        },
      }),
    )

    let computedCalls = 0
    const noopAtom = atom({})
    const a = atom(0).extend(
      withComputed((state) => {
        noopAtom()
        computedCalls++
        return state
      }),
      withSomePersist('a'),
    )

    expect(a()).toBe(1)
    expect(computedCalls).toBe(1)

    storage.set(
      { key: 'a' },
      {
        data: 2,
        id: random(),
        timestamp: Date.now(),
        to: Date.now() + 5 * 1000,
        version: 0,
      },
    )
    expect(a()).toBe(2)
    expect(computedCalls).toBe(1)

    noopAtom.set({})
    a()
    expect(computedCalls).toBe(2)
  })
})

describe('should not accept an action', () => {
  test('should throw an error', () => {
    const testAction = action(() => {})
    expect(() => testAction.extend(withSomePersist('test'))).toThrow()
  })
})

test('stale subscribed records do not overwrite fresher local writes', () => {
  let emitStoredRecord: ((record: PersistRecord<string>) => void) | undefined
  const withSubscribedPersist = reatomPersist<string>({
    name: 'auditSubscribedStorage',
    get: () => null,
    set: vi.fn(),
    subscribe: (_options, callback) => {
      emitStoredRecord = callback
      return noop
    },
  })

  const target = atom('initial', 'auditSubscribedAtom').extend(
    withSubscribedPersist('subscribed-key'),
  )
  const unsubscribe = target.subscribe(() => {})
  notify()

  target.set('fresh')
  emitStoredRecord?.(createRecord('stale', { timestamp: Date.now() - 1 }))

  unsubscribe()
  expect(target()).toBe('fresh')
})

test('migration result is not decoded a second time', () => {
  const withMigratingPersist = reatomPersist<number>({
    name: 'auditMigrationStorage',
    get: () => createRecord(1),
    set: vi.fn(),
  })

  const target = atom('initial', 'auditMigrationAtom').extend(
    withMigratingPersist({
      key: 'migration-key',
      version: 1,
      migration: () => 'migrated',
      fromSnapshot: (snapshot) => `decoded:${snapshot}`,
      toSnapshot: (state) => state.length,
    }),
  )

  expect(target()).toBe('migrated')
})
