// --- UTILS

export type Fn<Args extends any[] = any[], Return = any> = (
  ...a: Args
) => Return

export type Rec<Values = any> = Record<string, Values>

export type Merge<Intersection> = Intersection extends Fn
  ? Intersection
  : Intersection extends new (...a: any[]) => any
  ? Intersection
  : Intersection extends object
  ? {
      [Key in keyof Intersection]: Intersection[Key]
    }
  : Intersection

export type Values<T> = Merge<T[keyof T]>

export type OmitValues<Collection, Target> = Merge<
  Omit<
    Collection,
    Values<{
      [K in keyof Collection]: Collection[K] extends Target ? K : never
    }>
  >
>
export type PickValues<Collection, Target> = Merge<
  Pick<
    Collection,
    Values<{
      [K in keyof Collection]: Collection[K] extends Target ? K : never
    }>
  >
>

export type Replace<T, K extends keyof T, V> = {
  [k in keyof T]: k extends K ? V : T[k]
}

export const noop: Fn = () => {}

export function callSafety<I extends any[], O, This = any>(
  this: This,
  fn: (this: This, ...a: I) => O,
  ...args: I
): O | Error {
  try {
    return fn.apply(this, args)
  } catch (error: any) {
    error = error instanceof Error ? error : new Error(error)
    setTimeout(() => {
      throw error
    })
    return error
  }
}

// --- SOURCES

/** Context */
export type Ctx = {
  caches: WeakMap<Atom, AtomCache>
  log(cb: Fn<[Trz, Error?]>): Unsubscribe
  run<T>(cb: Fn<[Trz], T>): T
  stage: `idle` | `updates` | `computes` | `logs` | `effects`
  version: number
}

/** Transaction */
export type Trz = {
  __deps: null | Array<AtomCache>
  ctx: Ctx
  effects: Array<Fn>
  get<T extends Atom>(atom: T): T['state']
  patches: Map<Atom, AtomCache>
  queue: Array<AtomCache>
  schedule(cb: Fn): void
  spy<T extends Atom>(atom: T): T['state']
  updates: Array<AtomCache>
  version: number
}

export type AtomInternals = {
  __computers: Array<{ fn: Fn<[Trz]>; deps: Array<AtomCache> }>
  __isAtom: true
  __isInspectable: boolean
  __name: string
  __onCleanup: Array<Fn<[Trz]>>
  __onInit: Array<Fn<[Trz]>>
  __onUpdate: Array<Fn<[Trz]>>
}

/** Main spec of your data and it transitions. */
export type Atom = AtomInternals & {
  state?: any

  // [K: string]: undefined | null | {} | Fn<[Trz, ...any[]]>
}

export type AtomBase = {
  __isInspectable?: boolean
  __name?: string
  __onCleanup?: Array<Fn<[Trz]>>
  __onInit?: Array<Fn<[Trz]>>
  __onUpdate?: Array<Fn<[Trz]>>

  state?: any

  // any property or action
  [K: string]: undefined | null | {} | Fn<[Trz, ...any[]]>
  // computed
  [K: `$${string}`]: Fn<[Trz]>
}

export type AtomCache = Atom & {
  __children: Set<Atom>
  __listeners: Set<Fn<[any, AtomCache, Trz]>>
  __origin: Atom
  __prev: null | AtomCache
  __version: number
}

export type AtomState<T> = T extends Atom ? T['state'] : never

export type Causes = Array<Trz[`patches`]>

export type Unsubscribe = () => void

// export function assertsFunction(thing: any, name: string): asserts thing is Fn {
//   if (typeof thing !== 'function') {
//     throw new Error(`"${name}" should be a function`)
//   }
// }

export function throwCtxRestriction(ctx: Ctx): never {
  // FIXME: parametrize `here`
  throw new Error(`Using "${ctx.stage}" stage is restricted here.`)
}

export function createContext(): Ctx {
  const caches = new WeakMap<Atom, AtomCache>()
  const logs = new Set<Fn<[Trz, Error | null]>>()
  const ctx: Ctx = {
    caches,
    log,
    run,
    stage: `idle`,
    version: 0,
  }
  let transactions: Array<Trz> = []

  function log(cb: Fn<[Trz]>): Unsubscribe {
    logs.add(cb)
    return () => logs.delete(cb)
  }

  function run<T>(cb: Fn<[Trz], T>): T {
    if (ctx.stage === `updates` || ctx.stage === `logs`)
      throwCtxRestriction(ctx)

    const trz: Trz = {
      __deps: null,
      ctx,
      effects: [],
      get(atom) {
        return invalidateAtom(atom, this).state
      },
      patches: new Map(),
      queue: [],
      schedule(effect) {
        this.effects.push(effect)
      },
      spy(atom) {
        const cache = invalidateAtom(atom, trz)
        this.__deps?.push(cache)
        return cache.state
      },
      updates: [],
      version: ctx.version + 1,
    }
    let isNotInProcess = ctx.stage === `idle`

    ctx.stage = `updates`

    // TODO: catch -> log
    const res = cb(trz)

    transactions.push(trz)

    if (isNotInProcess) process()

    return res
  }

  function process() {
    let trzEffectIdx = 0
    let effectIdx = 0

    trz: for (const trz of transactions) {
      const { length } = transactions
      const { effects, patches, updates } = trz

      // STAGE `sort` (internal)

      const queue: Array<AtomCache> = updates
      trz.updates = []
      const stack = queue.map((cache) => {
        patches.set(cache.__origin, cache)
        return cache.__children
      })
      fillStack()
      function fillStack() {
        for (const children of stack) {
          for (const child of children) {
            if (patches.has(child)) continue
            let cache = caches.get(child)!
            cache = { ...cache, __prev: cache }
            stack.push(cache.__children)
            if (cache.__listeners.size > 0) queue.push(cache)
            // mark atom as dirty
            patches.set(child, cache)
          }
        }
      }

      // STAGE `computes`
      ctx.stage = `computes`

      let error: Error | null = null

      invalidate()
      function invalidate() {
        try {
          for (const cache of queue) invalidateAtom(cache, trz)
        } catch (err) {
          error = err instanceof Error ? err : new Error(String(err))
        }
      }

      // STAGE `logs`

      ctx.stage = `logs`

      logs.forEach((log) => log(trz, error))
      for (const log of logs) log(trz, error)

      if (error) {
        transactions.pop()
      } else {
        // STAGE `commit` (internal)

        commit()
        function commit() {
          for (const [atom, patch] of patches) {
            ctx.caches.set(atom, patch)

            const prev = patch.__prev
            if (prev !== null) {
              for (const { deps } of prev.__computers) {
                for (const cache of deps) cache.__children.delete(atom)
              }
            }
            for (const { deps } of patch.__computers) {
              for (const cache of deps) cache.__children.add(atom)
            }

            if (prev === null || !Object.is(patch.state, prev.state)) {
              for (const l of patch.__listeners) {
                effects.push(() => l(patch.state, patch, trz))
              }
            }

            patch.__prev = null
          }
        }
      }

      ctx.version++

      // STAGE `effects`

      ctx.stage = `effects`

      while (true) {
        const { effects } = transactions[trzEffectIdx]!

        if (effectIdx < effects.length) {
          if (length !== transactions.length) continue trz

          callSafety(effects[effectIdx++], trz)
        }

        effectIdx = 0

        if (++trzEffectIdx === transactions.length) break
      }
    }

    transactions = []

    ctx.stage = `idle`
  }

  return ctx
}

let atomsCount = 0
export function atom<T extends AtomBase>(
  base: T & ThisType<Omit<T, `$${string}`>>,
): Merge<Omit<T, `$${string}` | `_${string}`>> & AtomInternals {
  const __computers: Atom[`__computers`] = []
  const origin: T & Atom = {} as any

  for (const key in base) {
    let el = base[key]

    if (typeof el === 'function') {
      if (key[0] === '$') {
        // @ts-expect-error
        __computers.push({ fn: el, deps: [] })

        continue
      } else {
        const fn = el
        // @ts-expect-error
        const action: Fn<[Trz, ...any[]]> = (el = function (
          this: Atom | AtomCache,
          trz,
          ...a
        ) {
          switch (trz.ctx.stage) {
            case `updates`: {
              const cache = getCache(this, trz)
              trz.updates.push(cache)
              return fn.call(cache, trz, ...a)
            }
            case `computes`: {
              let cache = getCache(this, trz)

              if (cache.__version === trz.ctx.version) {
                cache = { ...cache }
                trz.updates.push(cache)
              }

              return action.call(cache, trz, ...a)
            }
            case `logs`:
              throwCtxRestriction(trz.ctx)
            case `effects`:
            case `idle`:
              return trz.ctx.run((trz) => action.call(this, trz, ...a))
          }
        })
      }
    } else if (key[0] === '$') {
      throw new Error(
        `Invalid property "${key}", only computed functions could starts with "$"`,
      )
    }

    // @ts-expect-error
    origin[key] = el
  }

  origin.__computers = __computers

  origin.__isAtom = true

  origin.__isInspectable ??= Boolean(origin.__name)

  origin.__name ??= `atom#${++atomsCount}`

  // @ts-ignore
  return origin
}

function getCache(atom: Atom | AtomCache, trz: Trz): AtomCache {
  let cache = `__prev` in atom ? atom : trz.patches.get(atom)

  if (cache !== undefined) return cache

  cache = trz.ctx.caches.get(atom)

  if (cache !== undefined) return { ...cache, __prev: cache }

  return {
    ...atom,
    __children: new Set(),
    __listeners: new Set(),
    __origin: atom,
    __prev: null,
    __version: -1,
  }
}

export function invalidateAtom(atom: Atom | AtomCache, trz: Trz): AtomCache {
  const cache = getCache(atom, trz)

  trz.__deps?.push(cache)

  if (cache.__version === trz.version) return cache

  // mark atom as visited
  cache.__version = trz.version

  trz.patches.set(cache.__origin, cache)

  const { __computers } = cache
  const newComputers: AtomCache[`__computers`] = (cache.__computers = [])

  for (let { fn, deps } of __computers) {
    const trzComputed = { ...trz, __deps: [] }

    if (
      deps.length === 0 ||
      deps.some((dep) => {
        const depPatch = invalidateAtom(dep.__origin, trzComputed)
        return !Object.is(dep.state, depPatch.state)
      })
    ) {
      deps = trzComputed.__deps = []
      fn.call(cache, trzComputed)
    }

    newComputers.push({ fn, deps })
  }

  return cache
}

// -----------------------------------------------------------------------------
// TODO
// -----------------------------------------------------------------------------

export function subscribe<T extends Atom>(
  ctx: Ctx,
  atom: T,
  cb: (state: T['state'], cache: AtomCache, trz: Trz) => void,
) {
  // TODO: prevent linking in `update` stage?
  if (ctx.stage !== `idle` && ctx.stage !== `effects`) throwCtxRestriction(ctx)

  ctx.run((trz) => {
    trz.effects.push(() => {
      const cache = ctx.caches.get(atom)!
      cache.__listeners.add(cb)
      cb(cache.state, cache, trz)
    })

    trz.updates.push(invalidateAtom(atom, trz))
  })

  return () => {
    ctx.caches.get(atom)!.__listeners.delete(cb)
  }
}

export function castSpec<T extends AtomBase>(spec: T): T {
  return spec
}

export function primitive<T>(initState: T) {
  return castSpec({
    state: initState,
    update(trz, update: T | Fn<[T], T>): T {
      return (this.state =
        // @ts-expect-error
        typeof update === 'function' ? update(this.state) : update)
    },
  })
}

export function map<Parent extends Atom, Result>(
  parent: Parent,
  fn: Fn<[Parent[`state`]], Result>,
): { state: Result; $map: AtomBase[`$${string}`] } {
  return {
    state: fn(parent.state),
    $map(trz) {
      this.state = fn(trz.spy(parent))
    },
  }
}

const computedInitTrz: Trz = {
  spy: (atom: Atom) => atom.state,
  get: (atom: Atom) => atom.state,
  schedule: () => {},
} as any
export function computed<T>(fn: Fn<[Trz], T>) {
  return castSpec({
    state: fn(computedInitTrz),
    $computed(trz) {
      this.state = fn(trz)
    },
  })
}

function displayNameWithoutName() {
  const firstNameAtom = atom(primitive('John'))
  const lastNameAtom = atom(primitive('Doe'))
  const isFirstNameShortAtom = atom(
    map(firstNameAtom, (firstName) => firstName.length < 10),
  )
  const fullNameAtom = atom(
    computed((trz) => `${trz.spy(firstNameAtom)} ${trz.spy(lastNameAtom)}`),
  )

  const displayNameAtom = atom(
    computed((trz) =>
      trz.spy(isFirstNameShortAtom)
        ? trz.spy(firstNameAtom)
        : trz.spy(fullNameAtom),
    ),
  )
}

// displayNameWithName()
function displayNameWithName() {
  const ctx = createContext()

  const firstNameAtom = atom({ ...primitive('John'), __name: `firstName` })
  const lastNameAtom = atom({ ...primitive('Doe'), __name: `lastName` })
  const isFirstNameShortAtom = atom({
    ...map(firstNameAtom, (firstName) => firstName.length < 10),
    __name: `isFirstNameShort`,
  })
  const fullNameAtom = atom({
    ...computed((trz) => `${trz.spy(firstNameAtom)} ${trz.spy(lastNameAtom)}`),
    __name: `fullName`,
  })

  const displayNameAtom = atom({
    ...computed((trz) =>
      trz.spy(isFirstNameShortAtom)
        ? trz.spy(fullNameAtom)
        : trz.spy(firstNameAtom),
    ),
    __name: `displayName`,
  })

  subscribe(ctx, displayNameAtom, (v) => {
    v //?
  })

  ctx.run((trz) => firstNameAtom.update(trz, 'Joooooon'))
  ctx.run((trz) => firstNameAtom.update(trz, 'Joooooon'))
  ctx.run((trz) => firstNameAtom.update(trz, 'Jooooooooooooooooooon'))
  ctx.run((trz) => firstNameAtom.update(trz, 'Jooooooooooooooooooon'))

  ctx.caches.get(firstNameAtom) //?
}
