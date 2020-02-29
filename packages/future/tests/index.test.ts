import { Future, Ctx, Atom, STOP, all, race, reduce } from '../src'

function log(...a: any[]) {
  console.log('TEST', ...a)
}

describe('@reatom/future', () => {
  test('source', () => {
    log('source')
    const f = Future.of(0)

    expect(f.fork(1)).toBe(1)
  })
  test('chain', () => {
    log('chain')
    const f = Future.of(0).chain(v => v ** 2)

    expect(f.fork(2)).toBe(4)
  })
  test('chain async', async () => {
    log('chain async')
    const f = Future.of(0)
      .chain(v => Promise.resolve(v))
      .chain(v => v * 2)

    expect(f.fork(1)).toBeInstanceOf(Promise)
    expect(await f.fork(1)).toBe(2)
    expect(await Promise.all([f.fork(1), f.fork(2)])).toEqual([2, 4])
  })
  test('async concurrency', async () => {
    log('async concurrency')

    const fetchConcurrent = Future.from(async (data: number, cache) => {
      const tag = (cache.tag = (cache.tag || 0) + 1)

      await new Promise(r => setTimeout(r))

      if (tag !== cache.tag) return STOP
      return data
    })
    const cb = jest.fn()

    fetchConcurrent.subscribe(cb)

    fetchConcurrent.fork(1)
    fetchConcurrent.fork(2)
    fetchConcurrent.fork(3)

    await new Promise(r => setTimeout(r))

    expect(cb).toBeCalledTimes(1)
    expect(cb).toBeCalledWith(3)
  })
  test('subscription', () => {
    log('subscription')
    const f = Future.of(0)
    const cb = jest.fn()

    const unsubscribe = f.subscribe(v => cb(v))
    expect(cb).toBeCalledTimes(0)

    f.fork(1)
    expect(cb).toBeCalledWith(1)

    unsubscribe()

    f.fork(2)
    expect(cb).toBeCalledTimes(1)
  })
  test('subscription filter', () => {
    log('subscription filter')
    const f = Future.of(0).chain(v => {
      if (v % 2) return v
      return STOP
    })
    const cb = jest.fn()

    f.subscribe(v => cb(v))
    expect(cb).toBeCalledTimes(0)

    f.fork(1)
    expect(cb).toBeCalledTimes(1)

    f.fork(2)
    expect(cb).toBeCalledTimes(1)

    f.fork(3)
    expect(cb).toBeCalledTimes(2)
  })
  test('subscription contexts', () => {
    log('subscription contexts')
    const f = Future.of(0)
    const ctx1 = new Ctx()
    const ctx2 = new Ctx()
    const cb1 = jest.fn()
    const cb2 = jest.fn()

    f.subscribe(cb1, ctx1)
    f.subscribe(cb2, ctx2)

    f.fork(1)
    expect(cb1).toBeCalledTimes(0)
    expect(cb2).toBeCalledTimes(0)

    f.fork(1, ctx1)
    expect(cb1).toBeCalledTimes(1)
    expect(cb2).toBeCalledTimes(0)

    f.fork(1, ctx2)
    expect(cb1).toBeCalledTimes(1)
    expect(cb2).toBeCalledTimes(1)
  })
  test('combines', () => {
    log('combines')
    const f1 = Future.of(1)
    const f2 = Future.of(2)
    const cb1 = jest.fn()
    const cb2 = jest.fn()

    all([f1, f2]).subscribe(v => cb1(v))
    race([f1, f2]).subscribe(v => cb2(v))

    f1.fork(1)
    expect(cb1).toBeCalledTimes(0)
    expect(cb2).toBeCalledWith(1)

    f1.fork(2)
    expect(cb1).toBeCalledTimes(0)
    expect(cb2).toBeCalledWith(2)

    f2.fork(3)
    expect(cb1).toBeCalledTimes(1)
    expect(cb1).toBeCalledWith([2, 3])
    expect(cb2).toBeCalledWith(3)
  })
  test('all async stop', async () => {
    log('all async stop')
    const f1 = Future.of(0)
    const f2 = Future.of(0)
      .chain(v => Promise.resolve(v))
      .chain(v => {
        if (v % 2) return STOP
        return v
      })

    const cb = jest.fn()

    all([f1, f2]).subscribe(v => cb(v))

    f1.fork(1)
    await new Promise(r => setTimeout(r))
    expect(cb).toBeCalledTimes(0)

    f2.fork(2)
    await new Promise(r => setTimeout(r))
    expect(cb).toBeCalledTimes(1)
    expect(cb).toBeCalledWith([1, 2])

    f2.fork(3)
    await new Promise(r => setTimeout(r))
    expect(cb).toBeCalledTimes(1)

    f2.fork(4)
    await new Promise(r => setTimeout(r))
    expect(cb).toBeCalledTimes(2)
    expect(cb).toBeCalledWith([1, 4])
  })
  test('fork all', () => {
    log('all')
    const f1 = Future.of(1)
    const f2 = Future.of(2) //.chain(v => Promise.resolve(v))

    const fArray = all([f1, f2])
    expect(fArray.fork([3, 4])).toEqual([3, 4])

    const fShape = all({ f1, f2 })
    expect(fShape.fork({ f1: 3, f2: 4 })).toEqual({ f1: 3, f2: 4 })
  })
  test('life cycle', async () => {
    log('life cycle')
    const initState = 0
    const f = Future.of(initState, {
      init(me, cache, ctx) {
        let state = initState
        const timerId = setInterval(() => me.fork(++state, ctx))

        return () => cleanup(timerId)
      },
    })
    const cleanup = jest.fn((id: number) => clearInterval(id))
    const cb = jest.fn((v: number) => v === 2 && resolve())
    const unsubscribe = f.subscribe(cb)

    let resolve!: Function
    await new Promise(r => (resolve = r))
    unsubscribe()

    expect(cb).toBeCalledTimes(2)
    expect(cleanup).toBeCalledTimes(1)
  })
  test('atom', () => {
    log('atom')
    const f1 = Future.of(0)
    const f2 = Future.of('string')
    const cb = jest.fn()

    const atom = Atom.create(
      0,
      reduce(f1, (state, payload) => payload),
      reduce(f2, (state, payload) => payload),
    )

    const un = atom.subscribe(v => cb(v))

    atom.fork(1)
    expect(cb).toBeCalledWith(1)

    f1.fork(42)
    expect(cb).toBeCalledWith(42)

    f2.fork('string')
    expect(cb).toBeCalledWith('string')
    expect(cb).toBeCalledTimes(3)

    f2.fork('string')
    expect(cb).toBeCalledTimes(3)

    expect(atom.fork(1, new Ctx())).toBe(1)
    expect(cb).toBeCalledWith('string')
  })
  test('atom async', async () => {
    log('atom')
    const f1 = Future.of(0)
    const cb = jest.fn()

    const atom = Atom.create(
      0,
      reduce(f1, (state, payload) => payload),
      reduce(
        f1.chain(v => Promise.resolve(v * 2)),
        (state, payload) => payload,
      ),
    )

    const un = atom.subscribe(v => cb(v))

    f1.fork(1)
    expect(cb).toBeCalledWith(1)
    await new Promise(r => setTimeout(r))
    expect(cb).toBeCalledWith(2)
  })
  test.skip('ctx inherit', () => {
    log('ctx inherit')

    const globalCtx = new Ctx()
    const localCtx1 = (new InheritedCtx(globalCtx) as any) as Ctx
    const localCtx2 = (new InheritedCtx(globalCtx) as any) as Ctx
    const priceViewInstance1 = jest.fn()
    const priceViewInstance2 = jest.fn()

    const taxAtom = Atom.create(0.2)
    const costAtom = Atom.create(0)
    const priceAtom = Atom.all([taxAtom, costAtom]).chain(
      ([tax, payload]) => tax * payload,
    )

    taxAtom.subscribe(() => {}, globalCtx)
    priceAtom.subscribe(priceViewInstance1, localCtx1)
    priceAtom.subscribe(priceViewInstance2, localCtx2)

    costAtom.fork(10, localCtx1)
    expect(priceViewInstance1).toBeCalledWith(2)
    expect(priceViewInstance2).not.toBeCalled()

    costAtom.fork(100, localCtx2)
    expect(priceViewInstance1).toBeCalledWith(2)
    expect(priceViewInstance2).toBeCalledWith(20)

    taxAtom.fork(0.1, globalCtx)
    expect(priceViewInstance1).toBeCalledWith(1)
    expect(priceViewInstance2).toBeCalledWith(10)
  })
})
