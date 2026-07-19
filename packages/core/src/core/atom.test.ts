import { expect, subscribe, test, vi } from 'test'

import { withComputed } from '../extensions'
import { identity } from '../utils'
import {
  _read,
  type Atom,
  atom,
  computed,
  context,
  createAtom,
  isConnected,
  notify,
  top,
  withMiddleware,
  withTap,
} from './'

test('linking', () => {
  const name = 'linking'
  const a1 = atom(0, `${name}.a1`)
  const a2 = computed(() => a1(), `${name}.a2`)
  const fn = vi.fn(identity)

  const testEffect = computed(() => fn(a2()), `${name}.testEffect`)

  const { store } = context().state

  expect(store.has(testEffect)).toBeFalsy()

  const un = testEffect.subscribe()
  // expect(a1()).toBe(0)
  // expect(a2()).toBe(0)
  // expect(testEffect()).toBe(0)
  expect(store.has(testEffect)).toBeTruthy()
  expect(fn).toBeCalledTimes(1)
  expect(fn).toBeCalledWith(0)
  const a1Frame = store.get(a1)!
  const a2Frame = store.get(a2)!
  const testEffectFrame = store.get(testEffect)!
  expect(a1Frame.pubs).toEqual([context()])
  expect(a1Frame.subs).toEqual([a2])
  expect(a2Frame.pubs).toEqual([context(), a1Frame])
  expect(a2Frame.subs).toEqual([testEffect])
  expect(testEffectFrame.pubs).toEqual([context(), a2Frame])

  un()

  expect(a1Frame).toBe(store.get(a1)!)
  expect(a2Frame).toBe(store.get(a2)!)
  expect(testEffectFrame).toBe(store.get(testEffect)!)

  expect(a1Frame.subs.length).toBe(0)
  expect(a2Frame.subs.length).toBe(0)
  expect(testEffectFrame.subs.length).toBe(0)
})

test('reading', () => {
  const name = 'reading'
  const a = atom(0, `${name}.a`)
  const bFn = vi.fn(() => a())
  const bMiddleware = vi.fn((state: any) => state)
  const b = computed(bFn, `${name}.b`).extend(withTap(bMiddleware))

  expect(b()).toBe(0)
  expect(b()).toBe(0)
  expect(b()).toBe(0)
  expect(bFn).toBeCalledTimes(1)
  expect(bMiddleware).toBeCalledTimes(3)

  b.subscribe()
  expect(b()).toBe(0)
  expect(b()).toBe(0)
  expect(b()).toBe(0)
  expect(bFn).toBeCalledTimes(1)
  expect(bMiddleware).toBeCalledTimes(4)
})

test('disconnect tail deps', () => {
  const name = 'disconnectTail'
  const aAtom = atom(0, `${name}.aAtom`)
  const track = vi.fn(() => aAtom())
  const bAtom = computed(track, `${name}.bAtom`)
  const isActiveAtom = atom(true, `${name}.isActiveAtom`)
  const bAtomControlled = computed((state?: number) => {
    return isActiveAtom() ? bAtom() : state!
  }, `${name}.bAtomControlled`)

  expect(isConnected(bAtom)).toBe(false)
  bAtomControlled.subscribe()
  expect(track).toBeCalledTimes(1)

  isActiveAtom.set(false)
  notify()
  expect(isConnected(bAtom)).toBe(false)
  aAtom.set(aAtom() + 1)
  notify()
  expect(track).toBeCalledTimes(1)
})

test('deps shift', () => {
  const name = 'depsShift'
  const dep0 = atom(0, `${name}.dep0`)
  const dep1 = atom(0, `${name}.dep1`)
  const dep2 = atom(0, `${name}.dep2`)
  const deps = [dep0, dep1, dep2]

  const a = computed(() => deps.forEach((dep) => dep()), `${name}.a`)

  a.subscribe()

  dep0.set(dep0() + 1)
  notify()
  expect(isConnected(dep0)).toBeTruthy()

  deps.shift()
  dep0.set(dep0() + 1)
  expect(isConnected(dep0)).toBeTruthy()
  notify()
  expect(isConnected(dep0)).toBeFalsy()
})

test('subscribe to cached atom', () => {
  const name = 'cachedAtom'
  const a1 = atom(0, `${name}.a1`)
  const a2 = computed(() => a1(), `${name}.a2`)

  // First get the value without subscribing
  a2()
  // Then subscribe
  a2.subscribe()

  // Check that a1 has exactly one subscriber
  const a1Frame = _read(a1)
  expect(a1Frame?.subs.length).toBe(1)
})

test('subscribe initial callback runs in the target frame', () => {
  const source = atom(0, 'subscribeInitialCallbackFrame.source')
  const callbackAtoms = new Array<ReturnType<typeof top>['atom']>()

  source.subscribe(() => {
    callbackAtoms.push(top().atom)
  })

  expect(callbackAtoms).toEqual([source])

  source.set(1)
  notify()

  expect(callbackAtoms).toEqual([source, source])
})

test('update propagation for atom with listener', () => {
  const name = 'updatePropagation'
  const a1 = atom(0, `${name}.a1`)
  const a2 = computed(() => a1(), `${name}.a2`)
  const a3 = computed(() => a2(), `${name}.a3`)

  const cb2 = subscribe(a2)
  const cb3 = subscribe(a3)

  expect(cb2).toBeCalledTimes(1)
  expect(cb3).toBeCalledTimes(1)

  a1.set(1)
  notify()

  expect(cb2).toBeCalledTimes(2)
  expect(cb2).toBeCalledWith(1)
  expect(cb3).toBeCalledTimes(2)
  expect(cb3).toBeCalledWith(1)

  cb3.unsubscribe()
  expect(_read(a2)!.subs.length).toBe(1)
  expect(_read(a3)!.subs.length).toBe(0)
  a1.set(2)
  notify()
  expect(cb2).toBeCalledTimes(3)
  expect(cb2).toBeCalledWith(2)

  a3.subscribe(cb3)
  expect(_read(a2)!.subs.length).toBe(2)

  computed(() => a3()).subscribe()
  expect(_read(a2)!.subs.length).toBe(2)
})

test('conditional deps duplication', () => {
  const name = 'conditionalDeps'
  const condition = atom(true, `${name}.condition`)
  const dep1 = atom(1, `${name}.dep1`)
  const dep2 = atom(2, `${name}.dep2`)

  const conditional = computed(() => {
    if (condition()) {
      return dep1()
    } else {
      return dep2()
    }
  }, `${name}.conditional`)

  const fn = subscribe(computed(() => conditional(), `${name}.testEffect`))

  expect(fn).toBeCalledTimes(1)
  expect(fn).toBeCalledWith(1)

  expect(isConnected(dep1)).toBe(true)
  expect(isConnected(dep2)).toBe(false)

  condition.set(false)
  notify()
  expect(fn).toBeCalledTimes(2)
  expect(fn).toBeCalledWith(2)

  expect(isConnected(dep1)).toBe(false)
  expect(isConnected(dep2)).toBe(true)

  dep1.set(10)
  notify()
  expect(fn).toBeCalledTimes(2)

  dep2.set(20)
  notify()
  expect(fn).toBeCalledTimes(3)
  expect(fn).toBeCalledWith(20)

  condition.set(true)
  notify()
  expect(fn).toBeCalledTimes(4)
  expect(fn).toBeCalledWith(10)

  expect(isConnected(dep1)).toBe(true)
  expect(isConnected(dep2)).toBe(false)

  fn.unsubscribe()
  expect(isConnected(dep1)).toBe(false)
  expect(isConnected(dep2)).toBe(false)
})

test('computed without dependencies', () => {
  const name = 'noDeps'

  const a = createAtom(
    {
      initState: 0,
      computed: (state) => state + 1,
    },
    `${name}.a`,
  )

  expect(a()).toBe(1)
  expect(a()).toBe(1)
  expect(a.set(10)).toBe(11)

  a.subscribe()
  expect(a()).toBe(11)
  expect(a()).toBe(11)
  expect(a.set(100)).toBe(101)
})

test('error tracking', () => {
  const name = 'errorTracking'
  const a = atom(0, `${name}.a`)
  const b = computed(() => {
    const aState = a()
    if (aState < 5) throw new Error('error')
    success = true
    return a()
  }, `${name}.b`)
  computed(() => {
    try {
      b()
    } catch {
      // nothing
    }
  }, `${name}.effect`).subscribe()
  let success = false

  expect(isConnected(b)).toBe(true)
  expect(() => b()).toThrow()

  a.set(1)
  notify()
  expect(() => b()).toThrow()

  a.set(10)
  notify()
  expect(success).toBe(true)
  expect(b()).toBe(10)
})

test('middleware connection', () => {
  const name = 'middlewareConnection'
  const before = atom(null, `${name}.before`)
  const after = atom(null, `${name}.after`)
  const target = atom(null, `${name}.target`).extend(
    (middleware) =>
      ((...a: Parameters<typeof middleware>) => {
        before()
        const state = middleware(...a)
        after()
        return state
      }) as typeof middleware,
  )

  target.subscribe()
  expect(isConnected(target)).toBe(true)
  expect(isConnected(before)).toBe(false)
  expect(isConnected(after)).toBe(false)
})

test('computed should not accept params', () => {
  const name = 'computedNoParams'
  const dep = atom(0, `${name}.a`)
  const bComputed = vi.fn(() => dep())
  const lowLevelComputed = createAtom({ computed: bComputed }, `${name}.b`)
  const normalComputed = computed(() => dep(), `${name}.c`)

  expect(lowLevelComputed()).toBe(0)
  expect(lowLevelComputed()).toBe(0)
  expect(normalComputed()).toBe(0)
  expect(bComputed).toBeCalledTimes(1)

  dep.set((s) => s + 1)
  expect(lowLevelComputed()).toBe(1)
  expect(normalComputed()).toBe(1)
  expect(bComputed).toBeCalledTimes(2)

  expect(lowLevelComputed.set(2)).toBe(2)
  expect(lowLevelComputed()).toBe(2)
  // @ts-expect-error
  expect(() => normalComputed.set(2)).toThrow()
  // // @ts-expect-error
  // expect(() => normalComputed(2)).toThrow()
  expect(normalComputed()).toBe(1)
  expect(bComputed).toBeCalledTimes(2)
})

test('deps state cache do not cache deps pubs', async () => {
  const factory = atom<null | Atom<number | number>>(null)
  const proxyFn = vi.fn(() => factory()?.() ?? null)
  const proxy = computed(proxyFn)
  const consumerFn = vi.fn(() => proxy())
  const consumer = computed(consumerFn)

  expect(consumer()).toBe(null)

  const dep = factory.set(
    // @ts-ignore
    () => atom(null),
  )!

  proxyFn.mockClear()
  consumerFn.mockClear()

  // relinking process is trying to invalidate deps
  // and if it's states didn't change (null === null)
  // it may cache the deps, which is wrong and
  // it is where the original issue comes from
  // (`proxy` has only one pub, but should have two)
  consumer.subscribe()

  expect(proxyFn).toBeCalledTimes(1)
  expect(consumerFn).toBeCalledTimes(0)

  const { store } = context().state
  expect(store.get(consumer)!.subs.length).toBe(1)
  expect(store.get(proxy)!.subs.length).toBe(1)
  expect(store.get(dep)!.subs.length).toBe(1)

  dep.set(1)
  notify()
  expect(consumer()).toBe(1)
})

test('bidirectional link', () => {
  const name = 'bidirectionalLink'

  const single = atom(0, `${name}.single`).extend(
    withComputed(() => double() / 2),
  )
  const double: Atom<number> = atom(0, `${name}.double`).extend(
    withComputed(() => single() * 2),
  )

  expect(single()).toBe(0)
  expect(double()).toBe(0)

  single.set(1)
  expect(single()).toBe(1)
  expect(double()).toBe(2)

  double.set(8)
  expect(single()).toBe(4)
  expect(double()).toBe(8)

  single.subscribe()
  double.set(10)
  notify()
  expect(context().state.store.get(single)!.state).toBe(5)
})

test('middlewares order', () => {
  const name = 'middlewaresOrder'
  let logs: number[] = []
  const a = atom(0, `${name}.a`).extend(
    withMiddleware(() => (next, ...args) => {
      logs.push(1)
      return next(...args)
    }),
    withMiddleware(() => (next, ...args) => {
      logs.push(2)
      return next(...args)
    }),
  )

  expect(a()).toBe(0)
  expect(logs).toEqual([2, 1])
})

test('read middleware', () => {
  const name = 'readMiddleware'

  let externalState = 1

  const a = atom(0, `${name}.a`).extend(
    withMiddleware(
      () =>
        (next, ...args) => {
          top().state = externalState
          return next(...args)
        },
      'read',
    ),
  )

  expect(a()).toBe(1)
})

test('reactivity restored after error', () => {
  const name = 'reactivityRestoredAfterError'
  const source = atom(0, `${name}.source`)
  let shouldThrow = false
  const dep = computed(() => {
    source()
    if (shouldThrow) throw new Error('error')
    return 'state'
  }, `${name}.dep`)
  const consumer = computed(() => {
    return dep()
  }, `${name}.consumer`)
  const states = new Array<string>()

  consumer.subscribe((state) => states.push(state))
  expect(states).toEqual(['state'])

  shouldThrow = true
  source.set(1)
  notify()
  expect(states).toEqual(['state'])
  expect(() => consumer()).toThrow('error')

  shouldThrow = false
  source.set(2)
  notify()
  expect(consumer()).toBe('state')
  expect(states).toEqual(['state'])
})

test('error propagation for subscribe callback', () => {
  const name = 'errorSubscribe'

  const flag = atom(false, `${name}.flag`)
  const dep = computed(() => {
    if (flag()) {
      throw new Error(name)
    }
    return 'state'
  }, `${name}.dep`)

  const listener = subscribe(dep)
  expect(listener).toBeCalledTimes(1)
  expect(listener).toBeCalledWith('state')

  flag.set(true)
  notify()
  // without errorCb the throw escapes to the notify queue; userCb is skipped
  expect(listener).toBeCalledTimes(1)
  expect(() => dep()).toThrow(name)
})

test('subscribe errorCb receives thrown error and skips userCb', () => {
  const name = 'subscribeErrorCb'
  const source = atom(0, `${name}.source`)
  let shouldThrow = false
  const dep = computed(() => {
    let n = source()
    if (shouldThrow) throw new Error(name)
    return `ok-${n}`
  }, `${name}.dep`)

  const states: string[] = []
  const errors: unknown[] = []

  dep.subscribe(
    (state) => states.push(state),
    (error) => errors.push(error),
  )
  expect(states).toEqual(['ok-0'])
  expect(errors).toEqual([])

  shouldThrow = true
  source.set(1)
  notify()
  expect(states).toEqual(['ok-0'])
  expect(errors).toHaveLength(1)
  expect(errors[0]).toBeInstanceOf(Error)
  expect((errors[0] as Error).message).toBe(name)

  shouldThrow = false
  source.set(2)
  notify()
  expect(states).toEqual(['ok-0', 'ok-2'])
  expect(errors).toHaveLength(1)
})

test('subscribe userCb fires on recovery to the same state after errorCb', () => {
  const name = 'subscribeErrorRecoverySameState'
  const source = atom(0, `${name}.source`)
  let shouldThrow = false
  const dep = computed(() => {
    source()
    if (shouldThrow) throw new Error(name)
    return 'same'
  }, `${name}.dep`)

  const states: string[] = []
  const errors: unknown[] = []

  dep.subscribe(
    (state) => states.push(state),
    (error) => errors.push(error),
  )
  expect(states).toEqual(['same'])

  shouldThrow = true
  source.set(1)
  notify()
  expect(errors).toHaveLength(1)
  expect(states).toEqual(['same'])

  shouldThrow = false
  source.set(2)
  notify()
  // the subscriber saw an error last, so an equal state must still be delivered
  expect(states).toEqual(['same', 'same'])
  expect(errors).toHaveLength(1)
})

test('subscribe errorCb receives initial error', () => {
  const name = 'subscribeInitError'
  const dep = computed(() => {
    throw new Error(name)
  }, `${name}.dep`)

  const states: string[] = []
  const errors: unknown[] = []

  dep.subscribe(
    (state) => states.push(state),
    (error) => errors.push(error),
  )
  expect(states).toEqual([])
  expect(errors).toHaveLength(1)
  expect((errors[0] as Error).message).toBe(name)
})

test('subscribe without errorCb still throws on init', () => {
  const name = 'subscribeInitThrow'
  const dep = computed(() => {
    throw new Error(name)
  }, `${name}.dep`)

  expect(() => dep.subscribe(() => {})).toThrow(name)
})
