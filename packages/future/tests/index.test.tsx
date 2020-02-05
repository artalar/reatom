import { Future, Ctx } from '../src'

describe('@reatom/future', () => {
  test('source', () => {
    const f = Future.of(0)

    expect(f.fork(1)).toBe(1)
  })
  test('map', () => {
    const f = Future.of(0).map(v => v ** 2)

    expect(f.fork(2)).toBe(4)
  })
  test('map async', async () => {
    const f = Future.of(0).map(v => Promise.resolve(v))

    expect(await Promise.all([f.fork(1), f.fork(2)])).toEqual([1, 2])
  })
  test('subscription', () => {
    const f = Future.of(0)
    const cb = jest.fn()

    const unsubscribe = f.subscribe(cb)
    expect(cb).toBeCalledTimes(0)

    f.fork(1)
    expect(cb).toBeCalledWith(1)

    unsubscribe()

    f.fork(2)
    expect(cb).toBeCalledTimes(1)
  })
  test('subscription filter', () => {
    const f = Future.of(0)
      .map(v => {
        // all `undefined` will filtered (in types too!)
        if (v % 2) return v
      })
    const cb = jest.fn()

    f.subscribe(cb)
    expect(cb).toBeCalledTimes(0)

    f.fork(1)
    expect(cb).toBeCalledTimes(1)

    f.fork(2)
    expect(cb).toBeCalledTimes(1)

    f.fork(3)
    expect(cb).toBeCalledTimes(2)
  })
  test('subscription contexts', () => {
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
    const f1 = Future.of(1)
    const f2 = Future.of(2)
    const cb1 = jest.fn()
    const cb2 = jest.fn()

    Future.all([f1, f2]).subscribe(cb1)
    Future.race([f1, f2]).subscribe(cb2)

    f1.fork(1)
    expect(cb1).toBeCalledTimes(0)
    expect(cb2).toBeCalledWith(1)

    f1.fork(2)
    expect(cb1).toBeCalledTimes(0)
    expect(cb2).toBeCalledWith(2)

    f2.fork(3)
    expect(cb1).toBeCalledWith([2, 3])
    expect(cb2).toBeCalledWith(3)
  })
  test('life cycle', async () => {
    const initState = 0
    const f = Future.of(initState, {
      init(me, ctx) {
        let state = initState
        const timerId = setInterval(() => me.fork(++state, ctx))

        return () => cleanup(timerId)
      },
    })
    const cleanup = jest.fn((id: number) => clearInterval(id))
    const cb = jest.fn((v: number) => v === 2 && resolve())
    const unsubscribe = f.subscribe(cb)

    let resolve!: Function
    await new Promise(r => resolve = r)
    unsubscribe()

    expect(cb).toBeCalledTimes(2)
    expect(cleanup).toBeCalledTimes(1)
  })
})
