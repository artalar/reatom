import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { mockFn } from '../test_utils'

import { action, atom, AtomMeta, createContext, Fn } from './atom'
import { shallowEqual, init, atomizeActionLastResult } from './atom.utils'

const getDuration = async (cb: Fn) => {
  const start = Date.now()
  await cb()
  return Date.now() - start
}

test(`action`, () => {
  const act1 = action()
  const act2 = action()
  const fn = mockFn()
  const a1 = atom(0)
  const a2 = atom((ctx) => {
    ctx.spy(a1)
    ctx.spy(act1).forEach(() => fn(1))
    ctx.spy(act2).forEach(() => fn(2))
  })
  const ctx = createContext()

  ctx.subscribe(a2, () => {})
  assert.is(fn.calls.length, 0)

  act1(ctx)
  assert.is(fn.calls.length, 1)

  act1(ctx)
  assert.is(fn.calls.length, 2)

  act2(ctx)
  assert.is(fn.calls.length, 3)
  assert.equal(
    fn.calls.map(({ i }) => i[0]),
    [1, 1, 2],
  )

  a1.change(ctx, (s) => s + 1)
  assert.is(fn.calls.length, 3)
})

test(`linking`, () => {
  const a1 = atom(0, `a1`)
  const a2 = atom((ctx) => ctx.spy(a1), `a2`)
  const context = createContext()
  const fn = mockFn()

  context.subscribe((logs) => {
    logs.forEach((patch) =>
      assert.is.not(patch.cause, null, `"${patch.meta.name}" cause is null`),
    )
  })

  const un = context.subscribe(a2, fn)
  var a1Cache = context.read(a1.__reatom)!
  var a2Cache = context.read(a2.__reatom)!

  assert.is(fn.calls.length, 1)
  assert.is(fn.lastInput(), 0)
  assert.is(a2Cache.parents[0], a1Cache)
  assert.equal(a1Cache.children, new Set([a2.__reatom]))

  un()

  assert.is.not(a1Cache, context.read(a1.__reatom)!)
  assert.is.not(a2Cache, context.read(a2.__reatom)!)

  assert.is(context.read(a1.__reatom)!.children.size, 0)
})

test(`nested deps`, () => {
  const a1 = atom(0, `a1`)
  const a2 = atom((ctx) => ctx.spy(a1), `a2`)
  const a3 = atom((ctx) => ctx.spy(a1), `a3`)
  const a4 = atom((ctx) => ctx.spy(a2) + ctx.spy(a3), `a4`)
  const a5 = atom((ctx) => ctx.spy(a2) + ctx.spy(a3), `a5`)
  const a6 = atom((ctx) => ctx.spy(a4) + ctx.spy(a5), `a6`)
  const context = createContext()
  const fn = mockFn()
  const touchedAtoms: Array<AtomMeta> = []

  context.subscribe((logs) => {
    logs.forEach((patch) =>
      assert.is.not(patch.cause, null, `"${patch.meta.name}" cause is null`),
    )
  })

  const un = context.subscribe(a6, fn)

  for (const a of [a1, a2, a3, a4, a5, a6]) {
    assert.is(
      context.read(a.__reatom)!.stale,
      false,
      `"${a.__reatom.name}" should not be stale`,
    )
  }

  assert.is(fn.calls.length, 1)
  assert.equal(
    context.read(a1.__reatom)!.children,
    new Set([a2.__reatom, a3.__reatom]),
  )
  assert.equal(
    context.read(a2.__reatom)!.children,
    new Set([a4.__reatom, a5.__reatom]),
  )
  assert.equal(
    context.read(a3.__reatom)!.children,
    new Set([a4.__reatom, a5.__reatom]),
  )

  context.subscribe((logs) =>
    logs.forEach(({ meta }) => touchedAtoms.push(meta)),
  )

  try {
    a1.change(context, 1)
  } catch (error) {}

  assert.is(fn.calls.length, 2)
  assert.is(touchedAtoms.length, new Set(touchedAtoms).size)

  un()

  for (const a of [a1, a2, a3, a4, a5, a6]) {
    assert.is(
      context.read(a.__reatom)!.stale,
      true,
      `"${a.__reatom.name}" should be stale`,
    )
  }
})

test(`async batch`, async () => {
  const a = atom(0)
  const context = createContext({
    callLateEffects: (cb) => setTimeout(cb),
  })
  const fn = mockFn()
  context.subscribe(a, fn)

  assert.is(fn.calls.length, 1)
  assert.is(fn.lastInput(), 0)

  a.change(context, (s) => s + 1)
  a.change(context, (s) => s + 1)
  await Promise.resolve()
  a.change(context, (s) => s + 1)

  assert.is(fn.calls.length, 1)

  await new Promise((r) => setTimeout(r))

  assert.is(fn.calls.length, 2)
  assert.is(fn.lastInput(), 3)
})

test(`display name`, () => {
  const firstNameAtom = atom('John', `firstName`)
  const lastNameAtom = atom('Doe', `lastName`)
  const isFirstNameShortAtom = atom(
    ({ spy }) => spy(firstNameAtom).length < 10,
    `isFirstNameShort`,
  )
  const fullNameAtom = atom(
    ({ spy }) => `${spy(firstNameAtom)} ${spy(lastNameAtom)}`,
    `fullName`,
  )
  const displayNameAtom = atom(
    ({ spy }) =>
      spy(isFirstNameShortAtom) ? spy(fullNameAtom) : spy(firstNameAtom),
    `displayName`,
  )

  fullNameAtom.__reatom.onInit.push(() => {
    'init' //?
  })
  fullNameAtom.__reatom.onCleanup.push(() => {
    'cleanup' //?
  })
  displayNameAtom.__reatom.onInit.push(() => {
    'init' //?
  })
  displayNameAtom.__reatom.onCleanup.push(() => {
    'cleanup' //?
  })

  const ctx = createContext()

  const un = ctx.subscribe(displayNameAtom, () => {})

  firstNameAtom.change(ctx, 'Joooooooooooohn')

  try {
    firstNameAtom.change(ctx, 'Jooohn')
  } catch (error) {}

  un()
})

test(`resource`, async () => {
  const resource = <State, Params>(
    name: string,
    initState: State,
    fetcher: (state: State, params: Params) => Promise<State>,
    {
      isEqual = shallowEqual,
      fetchOnInit = false,
    }: {
      isEqual?: typeof shallowEqual
      fetchOnInit?: Params extends undefined ? boolean : false
    } = {},
  ) => {
    const initParams = Symbol() as any
    const paramsAtom = atom(initParams as Params, {
      name: `${name}ResourceParams`,
      isInspectable: false,
    })
    const versionAtom = atom(0, {
      name: `${name}ResourceVersion`,
      isInspectable: false,
    })
    const dataAtom = atom(initState, `${name}ResourceData`)
    const loadingAtom = atom(false, {
      reducers: { start: () => true, end: () => false },
      name: `${name}ResourceLoading`,
    })
    const errorAtom = atom<null | Error>(null, `${name}ResourceError`)

    const refetch = action(async (ctx, params: Params) => {
      paramsAtom.change(ctx, params)
      const version = versionAtom.change(ctx, (s) => s + 1)
      const isLast = () => version === ctx.get(versionAtom)

      loadingAtom.start(ctx)
      errorAtom.change(ctx, null)

      await ctx.schedule()

      try {
        const newState = await fetcher(
          ctx.get(dataAtom),
          // @ts-expect-error
          params === initParams ? undefined : params,
        )

        if (isLast()) onDone(ctx, newState)

        return newState
      } catch (err) {
        err = err instanceof Error ? err : new Error(String(err))

        // @ts-expect-error
        if (isLast()) onError(ctx, err)

        throw err
      }
    }, `${name}Resource.refetch`)

    const refetchPromiseAtom = atomizeActionLastResult(refetch)

    const fetch = action(async (ctx, params: Params): Promise<State> => {
      return isEqual(ctx.get(paramsAtom), params)
        ? ctx.get(loadingAtom)
          ? ctx.get(refetchPromiseAtom)!
          : ctx.get(dataAtom)
        : refetch(ctx, params)
    }, `${name}Resource.fetch`)

    const onDone = action((ctx, data: State): State => {
      loadingAtom.end(ctx)
      dataAtom.change(ctx, data)

      return data
    }, `${name}Resource.onDone`)

    const onError = action((ctx, err: Error): Error => {
      loadingAtom.end(ctx)
      errorAtom.change(ctx, err)

      return err
    }, `${name}Resource.onError`)

    const cancel = action((ctx): void => {
      loadingAtom.end(ctx)
      versionAtom.change(ctx, (s) => s + 1)
    }, `${name}Resource.cancel`)

    const retry = action((ctx): Promise<State> => {
      return refetch(ctx, ctx.get(paramsAtom))
    }, `${name}Resource.retry`)

    if (fetchOnInit) {
      dataAtom.__reatom.onInit.push((ctx) => {
        // @ts-expect-error
        refetch(ctx)
      })
    }

    return {
      cancel,
      dataAtom,
      changeData: dataAtom.change,
      errorAtom,
      fetch,
      loadingAtom,
      onDone,
      onError,
      refetch,
      refetchAtom: refetchPromiseAtom,
      retry,
    }
  }

  const ctx = createContext()

  type ImageData = { image_id: string; title: string }

  const pageAtom = atom(0, {
    reducers: {
      next: (state) => state + 1,
      prev: (state) => (state = Math.max(1, state - 1)),
    },
  })

  // @ts-ignore
  const fetch = (await import('node-fetch')) as any as typeof globalThis.fetch

  let i = 0
  const imagesResource = resource(
    `images`,
    new Array<ImageData>(),
    async (state, page: void | number = 0) => {
      if (i++ === 0) throw new Error(`just for test`)
      const result = await fetch(
        `https://api.artic.edu/api/v1/artworks?fields=image_id,title&page=${page}&limit=${10}`,
      )
        .then<{ data: Array<ImageData> }>((r) => r.json())
        .then(({ data }) => data.filter((el) => el.image_id))

      return result
    },
  )

  const startAtom = atom(NaN, `requestTimeStartAtom`)
  const endAtom = atom(NaN, `requestTimeEndAtom`)
  const requestTimeAtom = atom((ctx, state = 0) => {
    ctx.spy(imagesResource.refetch).forEach((refetchData) => {
      startAtom.change(ctx, Date.now())
    })

    ctx.spy(imagesResource.onDone).forEach((onDoneData) => {
      state = endAtom.change(ctx, Date.now()) - ctx.get(startAtom)
    })

    return state
  }, `requestTime`)

  const retryAtom = atom((ctx, state = 0) => {
    if (ctx.spy(imagesResource.onError).length && state < 3) {
      ctx.spy(imagesResource.onError) //?
      state++
      imagesResource.retry(ctx)
    }
    if (ctx.spy(imagesResource.onDone).length) {
      state = 0
    }
    return state
  }, `retry`)
  init(ctx, retryAtom)

  ctx.subscribe(requestTimeAtom, (requestTime) => {
    let log = '',
      { cause } = ctx.read(requestTimeAtom.__reatom)!
    while (cause) {
      log += `${cause.meta.name}`
      cause = cause === cause.cause ? null : cause.cause
      if (cause) log += ` <-- `
    }

    console.log(log)
  })

  await imagesResource.fetch(ctx).catch(() => null)
})

test(`timer`, async () => {
  const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))

  const createTimerModel = (name: string) => {
    const timerAtom = atom(0, `${name}Timer`)

    const intervalAtom = atom(1000, {
      reducers: {
        setSeconds: (state, seconds: number) => seconds * 1000,
      },
      name: `${name}TimerInterval`,
    })

    const versionAtom = atom(0, `${name}TimerVersion`)

    const startTimer = action(async (ctx, delayInSeconds: number) => {
      const version = versionAtom.change(ctx, (s) => s + 1)
      const delay = delayInSeconds * 1000
      const start = Date.now()
      const target = delay + start
      let remains = delay

      timerAtom.change(ctx, remains)

      await ctx.schedule()

      while (remains > 0) {
        await sleep(Math.min(remains, ctx.get(intervalAtom)))

        if (version !== ctx.get(versionAtom)) return

        timerAtom.change(ctx, (remains = target - Date.now()))
      }

      timerAtom.change(ctx, 0)
    }, `${name}StartTimer`)

    const stopTimer = action((ctx) => {
      versionAtom.change(ctx, (s) => s + 1)
      timerAtom.change(ctx, 0)
    }, `${name}StopTimer`)

    return {
      timerAtom,
      intervalAtom,
      startTimer,
      stopTimer,
    }
  }

  const timerModel = createTimerModel(`test`)
  const ctx = createContext()

  timerModel.intervalAtom.setSeconds(ctx, 0.001)

  var target = 50
  var duration = await getDuration(() =>
    timerModel.startTimer(ctx, target / 1000),
  )
  assert.ok(duration >= target)

  var target = 50
  var [duration] = await Promise.all([
    getDuration(() => timerModel.startTimer(ctx, target / 1000)),
    sleep(target / 2).then(() => timerModel.stopTimer(ctx)),
  ])
  assert.ok(duration >= target / 2 && duration < target)
})

test.run()
