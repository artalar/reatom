import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { mockFn } from '../test_utils'

import {
  action,
  Action,
  atom,
  Atom,
  AtomCache,
  AtomMeta,
  AtomMutable,
  createContext,
  Ctx,
  Rec,
} from './atom'
import {
  getPrev,
  shallowEqual,
  patchesToCollection,
  subscribeOnce,
  actionAtom,
} from './atom.utils'

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------

test(`linking`, () => {
  const a1 = atom(0, `a1`)
  const a2 = atom((ctx) => ctx.spy(a1), `a2`)
  const context = createContext()
  const fn = mockFn()

  context.log((logs) => {
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

  context.log((logs) => {
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

  context.log((logs) => logs.forEach(({ meta }) => touchedAtoms.push(meta)))

  a1.change(context, 1)

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

test.run()

// resourceExample()
async function resourceExample() {
  const model: {
    <T extends Rec<Atom>>(name: string, model: T): {
      // make all atoms readonly
      [K in keyof T]: T[K] extends Action<any, any>
        ? T[K]
        : T[K] extends Atom<infer State>
        ? Atom<State>
        : T[K]
    }
  } = (name, model) => {
    for (const key in model) {
      const el = model[key]

      // @ts-expect-error
      el.__reatom.name = `${key}__${name}`

      if (typeof el !== 'function') {
        // @ts-expect-error
        model[key] = { __reatom: el.__reatom }

        for (const k in el) {
          if (typeof el[k] === 'function') {
            // @ts-expect-error
            el[k].__reatom.name = `${k}__${el.__reatom.name}`
          }
        }
      }
    }

    return model as any
  }

  const resource = <State, Params>(
    name: string,
    initState: State,
    fetcher: (state: State, params: Params) => Promise<State>,
    isEqual = shallowEqual,
  ) => {
    const paramsAtom = atom(Symbol() as any as Params)
    const versionAtom = atom(0)
    const dataAtom = atom(initState)
    const loadingAtom = atom(false)
    const errorAtom = atom<null | Error>(null)

    const refetch = action(async (ctx, params: Params) => {
      paramsAtom.change(ctx, params)
      const version = versionAtom.change(ctx, (s) => s + 1)
      const isLast = () => version === ctx.get(versionAtom)

      loadingAtom.change(ctx, true)
      errorAtom.change(ctx, null)

      await ctx.schedule()

      try {
        const newState = await fetcher(ctx.get(dataAtom), params)

        if (isLast()) onDone(ctx, newState)

        return newState
      } catch (err) {
        err = err instanceof Error ? err : new Error(String(err))

        // @ts-expect-error
        if (isLast()) onError(ctx, err)

        throw err
      }
    })

    const refetchAtom = actionAtom(refetch)

    const fetch = action(async (ctx, params: Params): Promise<State> => {
      return isEqual(ctx.get(paramsAtom), params)
        ? ctx.get(loadingAtom)
          ? ctx.get(refetchAtom)!
          : ctx.get(dataAtom)
        : refetch(ctx, params)
    })

    const onDone = action((ctx, data: State): State => {
      loadingAtom.change(ctx, false)
      dataAtom.change(ctx, data)

      return data
    })

    const onError = action((ctx, err: Error): Error => {
      loadingAtom.change(ctx, false)
      errorAtom.change(ctx, err)

      return err
    })

    const cancel = action((ctx): void => {
      loadingAtom.change(ctx, false)
      versionAtom.change(ctx, (s) => s + 1)
    })

    const retry = action((ctx): Promise<State> => {
      return refetch(ctx, ctx.get(paramsAtom))
    })

    // dataAtom.__reatom.onInit.push((ctx) => {
    //   refetch(ctx)
    // })

    return model(name, {
      cancel,
      dataAtom,
      changeData: dataAtom.change,
      errorAtom,
      fetch,
      loadingAtom,
      onDone,
      onError,
      refetch,
      refetchAtom,
      retry,
    })
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
      return fetch(
        `https://api.artic.edu/api/v1/artworks?fields=image_id,title&page=${page}&limit=${10}`,
      )
        .then<{ data: Array<ImageData> }>((r) => r.json())
        .then(({ data }) => data.filter((el) => el.image_id))
    },
  )

  const startAtom = atom(NaN)
  const endAtom = atom(NaN)
  const requestTimeAtom = atom((ctx, state = 0) => {
    ctx.spy(imagesResource.refetch).forEach((promise) => {
      startAtom.change(ctx, Date.now())
    })

    ctx.spy(imagesResource.onDone).forEach(() => {
      state = endAtom.change(ctx, Date.now()) - ctx.get(startAtom)
    })

    return state
  }, `requestTime`)

  const retryAtom = atom((ctx, state = 0) => {
    if (ctx.spy(imagesResource.onError).some(() => true) && state < 3) {
      state++
      imagesResource.retry(ctx)
    }
    if (ctx.spy(imagesResource.onDone).some(() => true)) {
      state = 0
    }
    return state
  }, `retry`)

  ctx.subscribe(requestTimeAtom, (requestTime) => {
    // console.log(cause)
    // onDone__images <- refetch__images <- retry__images
    //  <- retry <- onError__images <- refetch__images <- fetch__images <- external call
  })
  ctx.subscribe(retryAtom, () => {})

  imagesResource.fetch(ctx).catch(() => null)
}

// timerExample()
function timerExample() {
  const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))

  const timerAtom = atom(0)

  const intervalAtom = atom(1000, {
    reducers: {
      setSeconds: (state, seconds: number) => seconds * 1000,
    },
  })

  const versionAtom = atom(0)

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
  })

  const stopTimer = action((ctx) => {
    versionAtom.change(ctx, (s) => s + 1)
    timerAtom.change(ctx, 0)
  })
}

// displayNameExample()
function displayNameExample() {
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
    console.log('init')
  })
  fullNameAtom.__reatom.onCleanup.push(() => {
    console.log('cleanup')
  })
  displayNameAtom.__reatom.onInit.push(() => {
    console.log('init')
  })
  displayNameAtom.__reatom.onCleanup.push(() => {
    console.log('cleanup')
  })

  const ctx = createContext()

  const un = ctx.subscribe(displayNameAtom, () => {})

  firstNameAtom.change(ctx, 'Joooooooooooohn')

  firstNameAtom.change(ctx, 'Jooohn')

  un()
}
