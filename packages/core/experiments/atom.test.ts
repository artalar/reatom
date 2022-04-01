import {
  action,
  Action,
  atom,
  Atom,
  createContext,
  Ctx,
  Patches,
  Rec,
} from './atom'

export const isObject = (thing: any): thing is Record<keyof any, any> =>
  typeof thing === 'object' && thing !== null

export const shallowEqual = (a: any, b: any) => {
  if (isObject(a) && isObject(b)) {
    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)
    return (
      aKeys.length === bKeys.length && aKeys.every((k) => Object.is(a[k], b[k]))
    )
  } else {
    return Object.is(a, b)
  }
}

export const patchesToCollection = (patches: Patches) =>
  [...patches].reduce(
    (acc, [{ name }, { state }]) => ((acc[name] = state), acc),
    {} as Rec,
  )

// -----------------------------------------------------------------------------
// TESTS
// -----------------------------------------------------------------------------

export const getPrev = <T>(ctx: Ctx, atom: Atom<T>) => {
  return ctx.read(atom)?.state
}

displayNameWithoutName()
function displayNameWithoutName() {
  const firstNameAtom = atom('John', `firstName`)
  const lastNameAtom = atom('Doe', `lastName`)
  const isFirstNameShortAtom = atom(
    ({ spy }) => spy(firstNameAtom).length < 10,
    `isFirstNameShort`,
  )
  const fullNameAtom = atom(
    ({ spy }) => `${spy(firstNameAtom)} ${spy(lastNameAtom)}`,
    {
      name: `fullName`,
      onInit: [() => console.log('init')],
      onCleanup: [() => console.log('cleanup')],
    },
  )
  const displayNameAtom = atom(
    ({ spy }) =>
      spy(isFirstNameShortAtom) ? spy(fullNameAtom) : spy(firstNameAtom),
    `displayName`,
  )

  const ctx = createContext()

  ctx.log((patches) => {
    console.log(patchesToCollection(patches))
  })

  const un = ctx.subscribe(displayNameAtom, (state) => {
    console.log(state)
  })

  firstNameAtom.change(ctx, 'Joooooooooooohn')

  firstNameAtom.change(ctx, 'Jooohn')

  un()
}

resourceExample()
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

    const fetch = action(async (ctx, params: Params) => {
      return isEqual(ctx.get(paramsAtom), params)
        ? ctx.read(dataAtom)
        : refetch(ctx, params)
    })

    const onDone = action((ctx, data: State) => {
      loadingAtom.change(ctx, false)
      dataAtom.change(ctx, data)
    })

    const onError = action((ctx, err: Error) => {
      loadingAtom.change(ctx, false)
      errorAtom.change(ctx, err)
    })

    const cancel = action((ctx) => {
      loadingAtom.change(ctx, false)
      versionAtom.change(ctx, (s) => s + 1)
    })

    const retry = action((ctx) => {
      refetch(ctx, ctx.get(paramsAtom))
    })

    // dataAtom.__reatom.onInit.push((ctx) => {
    //   refetch(ctx)
    // })

    return model(name, {
      _paramsAtom: paramsAtom,
      _versionAtom: versionAtom,
      cancel,
      dataAtom,
      errorAtom,
      fetch,
      loadingAtom,
      onDone,
      onError,
      refetch,
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
    ctx.spy(imagesResource.refetch).forEach(() => {
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

  ctx.subscribe(requestTimeAtom, (requestTime, { cause }) => {
    console.log(cause)
    // external call -> fetch__images -> refetch__images -> onError__images -> retry
    //   -> retry__images -> refetch__images -> onDone__images
  })
  ctx.subscribe(retryAtom, () => {})

  imagesResource
    .fetch(ctx)

    .catch(() => null)
}
