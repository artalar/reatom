import { expect, expectTypeOf, subscribe, test, vi } from 'test'

import { withAsyncData } from '../async/withAsyncData'
import { action, atom, computed, context, top } from '../core'
import { schedule, wrap } from '../methods'
import { createMemStorage, type PersistRecord, reatomPersist } from '../persist'
import {
  type AbstractRender,
  reatomAbstractRender,
} from '../reatomAbstractRender'
import { withSearchParams } from '../routing'
import { type Fn, noop, type Rec, sleep } from '../utils'
import { urlAtom } from '../web'
import { withCache, type WithCacheOptions } from './withCache'

test('withCache', async () => {
  const name = 'withCache.basic'
  const fetchData = action(
    async ({ a, b: _b }: { a: number; b: number }) => a,
    `${name}.fetch`,
  ).extend(withAsyncData({ initState: 0 }), withCache())

  await wrap(fetchData({ a: 400, b: 0 }))

  const promise1 = fetchData({ a: 123, b: 0 })
  expect(fetchData.pending()).toBe(1)
  expect(fetchData.ready()).toBe(false)
  expect(fetchData.data()).toBe(400)

  expect(await wrap(promise1)).toBe(123)
  expect(fetchData.pending()).toBe(0)
  expect(fetchData.ready()).toBe(true)
  expect(fetchData.data()).toBe(123)

  fetchData({ a: 400, b: 0 }).catch(noop)
  expect(fetchData.pending()).toBe(0)
  expect(fetchData.ready()).toBe(true)
  expect(fetchData.data()).toBe(400)

  fetchData({ b: 0, a: 123 })
  expect(fetchData.pending()).toBe(0)
  expect(fetchData.ready()).toBe(true)
  expect(fetchData.data()).toBe(123)
})

test('withCache dataAtom mapper', async () => {
  const name = 'withCache.dataMapper'
  const fetchData = action(async (n: number) => n, `${name}.fetch`).extend(
    withAsyncData({
      initState: { payload: 0 },
      mapPayload: (payload) => ({ payload }),
    }),
    withCache(),
  )

  await wrap(fetchData(1))
  expect(fetchData.data().payload).toBe(1)

  await wrap(fetchData(2))
  expect(fetchData.data().payload).toBe(2)

  fetchData(1).catch(noop)
  expect(fetchData.data().payload).toBe(1)
})

test('withCache sync action', () => {
  const name = 'withCache.syncAction'
  const effect = vi.fn((n: number) => n)
  const getValue = action(effect, `${name}.get`).extend(withCache())

  expect(getValue(0)).toBe(0)
  expect(getValue(1)).toBe(1)
  expect(getValue(0)).toBe(0)
  expect(effect.mock.calls.length).toBe(2)
})

test('withCache sync action cache equality', () => {
  const name = 'withCache.syncAction'
  const getValue = action(<T>(value: T): T => value, `${name}.get`).extend(
    withCache(),
  )

  const obj = { lalala: true }

  expect(getValue(obj)).toBe(obj)
  expect(getValue({ lalala: true })).toBe(obj)
})

test('withCache sync computed', () => {
  const name = 'withCache.syncComputed'
  const param = atom(0, `${name}.param`)
  let offset = -1
  const effect = vi.fn((n: number) => {
    offset += 1
    return n + offset
  })
  const resource = computed(() => effect(param()), `${name}.resource`).extend(
    withCache(),
  )

  subscribe(resource)

  expect(resource()).toBe(0)

  param.set(1)
  expect(resource()).toBe(2)

  param.set(0)
  expect(resource()).toBe(0)
})

test('withCache swr false', async () => {
  const name = 'withCache.swrTrue'
  const fetchData = action(async (n: number) => n, `${name}.fetch`).extend(
    withAsyncData({ initState: 0 }),
    withCache({ swr: false }),
  )

  await wrap(
    Promise.all([
      fetchData(1).catch(noop),
      fetchData(2).catch(noop),
      fetchData(3).catch(noop),
    ]),
  )

  expect(fetchData.data()).toBe(3)

  const promise = fetchData(1)
  expect(fetchData.data()).toBe(3)
  await wrap(promise)
  expect(fetchData.data()).toBe(1)
})

test('withCache swr true', async () => {
  const name = 'withCache.swrTrue'
  const fetchData = action(async (n: number) => n, `${name}.fetch`).extend(
    withAsyncData({ initState: 0, status: true }),
    withCache({ swr: true }),
  )

  await wrap(
    Promise.all([
      fetchData(1).catch(noop),
      fetchData(2).catch(noop),
      fetchData(3).catch(noop),
    ]),
  )

  expect(fetchData.data()).toBe(3)

  fetchData(1).catch(noop)
  expect(fetchData.data()).toBe(1)
  expect(fetchData.status().isPending).toBe(false)
  expect(fetchData.status().isSWR).toBe(true)

  fetchData(2).catch(noop)
  expect(fetchData.data()).toBe(2)
  expect(fetchData.ready()).toBe(true)
  expect(fetchData.status().isSWR).toBe(true)
})

test('withCache computed swr false', async () => {
  const name = 'withCache.computedSWRFalse'
  const param = atom(1, `${name}.param`)
  const effect = vi.fn(async (n: number) => n)
  const resource = computed(
    async () => effect(param()),
    `${name}.resource`,
  ).extend(withAsyncData({ initState: 0 }), withCache({ swr: false }))

  subscribe(resource.data)

  await wrap(sleep())
  expect(resource.data()).toBe(1)

  param.set(2)
  await wrap(sleep())
  expect(resource.data()).toBe(2)

  param.set(1)
  expect(resource.data()).toBe(1)
})

test('withCache computed swr false', async () => {
  const name = 'withCache.computedSWRFalse'
  const param = atom(1, `${name}.param`)
  const effect = vi.fn(async (n: number) => n)
  const resource = computed(
    async () => effect(param()),
    `${name}.resource`,
  ).extend(withAsyncData({ initState: 0 }), withCache({ swr: true }))

  subscribe(resource.data)

  await wrap(sleep())
  expect(resource.data()).toBe(1)

  param.set(2)
  param.set(3)
  param.set(4)
  await wrap(sleep())
  expect(resource.data()).toBe(4)

  param.set(1)
  expect(resource.data()).toBe(1)
})

test('withPersist', async () => {
  const name = 'withCache.persist'
  const mockStorage = createMemStorage({ name: 'test' })
  const withMock = reatomPersist(mockStorage)

  const effect = vi.fn(async (a: number, b: number) => a + b)
  const fetchData1 = action(effect, `${name}.fetch1`).extend(
    withAsyncData({ initState: 0 }),
    withCache({
      withPersist: (options) => withMock({ ...options, key: 'fetch' }),
    }),
  )
  const fetchData2 = action(effect, `${name}.fetch2`).extend(
    withAsyncData({ initState: 0 }),
    withCache({
      withPersist: (options) => withMock({ ...options, key: 'fetch' }),
    }),
  )

  await wrap(fetchData1(1, 2))
  expect(fetchData1.data()).toBe(3)

  fetchData2(1, 2).catch(noop)
  expect(fetchData2.data()).toBe(3)
})

test('types: accepts generic persist adapter directly', () => {
  const name = 'withCache.persistTypes'
  const withSSR = reatomPersist(createMemStorage({ name }))
  const resource = computed(async () => '', `${name}.resource`)

  expectTypeOf(withSSR).toExtend<
    NonNullable<WithCacheOptions<typeof resource>['withPersist']>
  >()

  resource.extend(withCache({ withPersist: withSSR }))
})

test('do not cache throwed', async () => {
  const name = 'withCache.noThrowed'

  let shouldThrow = false
  const fetchData = action(async (n: number) => {
    if (shouldThrow) throw 42
    return n
  }, `${name}.fetch`).extend(withAsyncData({ initState: 0 }), withCache({}))

  await wrap(fetchData(1))
  expect(fetchData.data()).toBe(1)

  shouldThrow = true
  await wrap(fetchData(2).catch(noop))
  expect(fetchData.data()).toBe(1)

  shouldThrow = false
  const promise = fetchData(2)
  expect(fetchData.data()).toBe(1)
  await wrap(promise)
  expect(fetchData.data()).toBe(2)

  fetchData(1).catch(noop)
  expect(fetchData.data()).toBe(1)
  fetchData(2).catch(noop)
  expect(fetchData.data()).toBe(2)
})

test('should be able to manage cache manually', async () => {
  const name = 'withCache.manual'
  const effect = vi.fn(async (n: number) => n)
  const fetchData = action(effect, `${name}.fetch`).extend(
    withAsyncData({ initState: 0 }),
    withCache(),
  )

  fetchData(1)
  expect(effect.mock.calls.length).toBe(1)
  expect(fetchData.data()).toBe(0)
  await wrap(sleep())
  expect(fetchData.data()).toBe(1)

  fetchData.cacheAtom.setWithParams([2], 2)
  fetchData(2).catch(noop)
  expect(effect.mock.calls.length).toBe(1)
  expect(fetchData.data()).toBe(2)
  await wrap(sleep())
  expect(effect.mock.calls.length).toBe(1)
  expect(fetchData.data()).toBe(2)

  fetchData(1).catch(noop)
  expect(effect.mock.calls.length).toBe(1)

  fetchData.cacheAtom.deleteWithParams([1])
  fetchData(1).catch(noop)
  expect(effect.mock.calls.length).toBe(2)
})

test('Infinity cache invalidation', async () => {
  const name = 'withCache.infinityStale'
  const effect = vi.fn(async (n: number) => n)
  const fetchData = action(effect, `${name}.fetch`).extend(
    withAsyncData({ initState: 0 }),
    withCache({ swr: false, staleTime: Infinity }),
  )

  await wrap(fetchData(1))
  await wrap(fetchData(2))
  expect(effect.mock.calls.length).toBe(2)

  await wrap(fetchData.cacheAtom.invalidate())
  expect(effect.mock.calls.length).toBe(3)
})

test('reactive cache', async () => {
  const name = 'withCache.reactive'
  const myStorage = createMemStorage({ name: 'myModel', subscribe: true })
  const withMyModelPersist = reatomPersist(myStorage)

  const a = atom(0, `${name}.a`).extend(withMyModelPersist('a'))
  const r = computed(async () => {
    const value = a()
    await wrap(sleep())
    return value
  }, `${name}.r`).extend(
    withAsyncData({ initState: 0 }),
    withCache({
      ignoreAbort: false,
      withPersist: (options) => withMyModelPersist(options),
    }),
  )

  subscribe(r.data)
  subscribe(r.cacheAtom)

  await wrap(sleep())
  expect(r.data()).toBe(0)

  const snapshot = await wrap(
    context.start(async () => {
      a.set(3)
      await wrap(r())
      await wrap(sleep())
      expect(r.data()).toBe(3)
      return myStorage.snapshotAtom()
    }),
  )

  myStorage.snapshotAtom.set(snapshot)
  expect(a()).toBe(3)
  expect(r.data()).toBe(3)
})

test('SSR example', async () => {
  const allSettled = (start: Fn) =>
    new Promise<void>((resolve) => {
      let i = 0
      let { root } = top()
      let { pushQueue } = root

      root.pushQueue = (cb, queue) => {
        root[queue].push(async () => {
          try {
            i++
            await cb()
          } finally {
            if (--i === 0) {
              resolve()
              root.pushQueue = pushQueue
            }
          }
        })
      }

      start()
    })

  // same for client and server in this test, different IRL
  const setupUrl = () => {
    urlAtom.sync.set(() => noop)
    urlAtom.set(new URL('https://example.com/?q=test-query'))
  }

  const name = 'withCache.ssr'
  const ssrStorage = createMemStorage({ name: 'ssr' })
  const withSSR = reatomPersist(ssrStorage)

  const params = atom('', `${name}.params`).extend(withSearchParams('q'))
  const resource = computed(async () => {
    const value = params()
    await wrap(schedule(() => sleep(10)))
    return value
  }, `${name}.resource`).extend(
    withAsyncData({ initState: '' }),
    withCache({ withPersist: withSSR }),
  )

  const server = async () => {
    setupUrl()
    await wrap(
      allSettled(() => {
        // trigger explicitly in this test, should call "render" IRL
        resource.data()
      }),
    )
    return ssrStorage.snapshotAtom()
  }

  const client = (snapshot: Rec<PersistRecord<unknown>>) => {
    setupUrl()

    ssrStorage.snapshotAtom.set(snapshot)

    expect(params()).toBe('test-query')
    expect(resource.data()).toBe('test-query')
  }

  const snapshot = await wrap(context.start(() => server()))

  await wrap(client(snapshot))
})

test('pending stays correct after a persist-hydrated cache hit under a computed view', async () => {
  // Repro conditions (all three required — drop any one and it behaves):
  // 1. withCache({ withPersist }) hydrated from a snapshot (SSR handoff);
  // 2. the hydration delivers a cache HIT on the very first computation after mount;
  // 3. `pending` is connected only THROUGH a parent computed (how view bindings read it),
  //    not via a direct `pending.subscribe`.
  // Then the hit leaves `pending` at -1: the +1 of the hydration delivery pair is lost while
  // the -1 of onSettle lands. Every later REAL fetch then runs with `pending === 0` (a view
  // showing skeletons by `pending > 0` shows none) and settles back to -1.
  const name = 'withCache.hydratedPending'
  const storage = createMemStorage({ name, subscribe: false })
  const withSSR = reatomPersist(storage)

  const make = () => {
    const cursor = atom<string | null>(null, `${name}.cursor`)
    const pageSize = computed(
      () => (cursor() === null ? 7 : 20),
      `${name}.pageSize`,
    )
    const query = computed(async () => {
      const cur = cursor()
      const limit = pageSize()
      return await wrap(
        schedule(async () => {
          await sleep(10)
          return `${cur}:${limit}`
        }),
      )
    }, `${name}.query`).extend(
      withAsyncData({ initState: 'INIT' }),
      withCache({ withPersist: withSSR }),
    )
    return { cursor, query }
  }

  // server: fill the cache for the initial params, snapshot
  const snapshot = await wrap(
    context.start(async () => {
      const { query } = make()
      await wrap(query())
      await wrap(sleep(20))
      return storage.snapshotAtom()
    }),
  )

  // client: hydrate, mount a view (a computed reading data + pending), then paginate
  await wrap(
    context.start(async () => {
      const { cursor, query } = make()
      storage.snapshotAtom.set(snapshot)

      const un = computed(() => {
        query.data()
        return query.pending()
      }, `${name}.view`).subscribe(noop)

      await wrap(sleep(20))
      expect(query.data()).toBe('null:7') // hydrated, no refetch
      expect(query.pending()).toBe(0)

      cursor.set('c2') // paginate → a REAL fetch is in flight
      await wrap(sleep(1))
      expect(query.pending()).toBe(1) // ← currently 0: the skeletons-never-show symptom

      await wrap(sleep(40))
      expect(query.data()).toBe('c2:20')
      expect(query.pending()).toBe(0) // ← currently -1: the negative-pending symptom

      un()
    }),
  )
})

test('remount after an SSR-hydrated cache hit must render, not throw the cache AbortError', async () => {
  // A persist-hydrated cache hit aborts the call's own withAbort controller and
  // poisons the query state with a promise rejected by 'cache'. Render-style
  // reads survive, but a direct `await query()` (a route loader on navigating
  // back) throws it. A live-fetched cache record never reproduces this.
  const name = 'withCache.remount'
  const storage = createMemStorage({ name, subscribe: false })
  const withSSR = reatomPersist(storage)

  const make = () => {
    const cursor = atom<string | null>(null, `${name}.cursor`)
    const pageSize = computed(
      () => (cursor() === null ? 7 : 20),
      `${name}.pageSize`,
    )
    const query = computed(async () => {
      const cur = cursor()
      const limit = pageSize()
      return await wrap(
        schedule(async () => {
          await sleep(10)
          return `${cur}:${limit}`
        }),
      )
    }, `${name}.query`).extend(
      withAsyncData({ initState: 'INIT' }),
      withCache({ withPersist: withSSR }),
    )
    return { cursor, query }
  }

  // server: fill the cache, snapshot
  const snapshot = await wrap(
    context.start(async () => {
      const { query } = make()
      await wrap(query())
      await wrap(sleep(20))
      return storage.snapshotAtom()
    }),
  )

  await wrap(
    context.start(async () => {
      const { query } = make()
      storage.snapshotAtom.set(snapshot)

      // what reatom-react's `reatomComponent` does for a list view
      const mountView = () => {
        const view: AbstractRender<Rec, { data: string; pending: number }> =
          reatomAbstractRender({
            frame: top().root.frame,
            render: () => ({ data: query.data(), pending: query.pending() }),
            rerender: () => view.render({}),
            name: `${name}.view`,
            abortOnUnmount: false,
          })
        // React order: render phase, then the mount effect
        const first = view.render({}).result
        const unmount = view.mount()
        return { first, unmount, render: () => view.render({}).result }
      }

      // visit 1: SSR landing — hydration cache hit, no loader on hydration
      const view1 = mountView()
      await wrap(sleep(20))
      expect(view1.render().data).toBe('null:7')
      view1.unmount() // navigate away

      await wrap(sleep(20))

      // visit 2: navigate back — the route loader awaits the query before render
      await wrap(query()) // ← bug: rejects '<name>.query.withAbort cache [#N]'

      const view2 = mountView()
      await wrap(sleep(20))
      expect(view2.render().data).toBe('null:7')
      expect(view2.render().pending).toBe(0)
      view2.unmount()
    }),
  )
})
