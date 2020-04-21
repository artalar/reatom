import { INTERNAL, STOP } from './constants'
import { createCtx } from './Ctx'
import {
  Atom,
  AtomOptions,
  Ctx,
  FilterStopUndef,
  Future,
  FutureOptions,
  getInternal,
  getIsAtomOptions,
  getIsFuture,
  InitHook,
  Ref,
} from './Future'
import { RunCache } from './RunCache'
import { RunCtx } from './RunCtx'
import { assign, getIsFunction, getIsString, invalid } from './shared'
import { ChainI, ChainO, Fn, FnI, FnO, Key, RefCache } from './types'

export type SomeFutureOptions = {
  lift: Fn<[unknown, RunCtx<Ctx, Future>]>

  executor: Fn<[RunCache[], Ref, RunCtx<Ctx, Future>], RunCache | unknown>

  deps: Future<unknown, unknown>[]

  name?: string
  key?: Key
  init?: InitHook<unknown, unknown>

  ctx?: Ctx
}

let _count = 0

export const filterStopUndef = <T>(value: T): FilterStopUndef<T> =>
  // eslint-disable-next-line no-nested-ternary
  value instanceof Promise
    ? value.then(filterStopUndef)
    : (value as any) === STOP
    ? undefined
    : (value as any)

export const defaultCtx = createCtx()

export function createSomeFuture(
  options: SomeFutureOptions,
): Future<unknown, unknown> {
  const {
    lift,
    executor,
    deps: _deps,
    name: _name = 'future',
    key: _key = `[${++_count}] ${_name}`,
    init: _init,
    ctx: _ctx = defaultCtx,
  } = options
  invalid(!getIsFunction(executor), 'executor - must be a function')

  invalid(!getIsString(_key), 'key - must be a string (or undefined)')

  invalid(
    !(_init === undefined || getIsFunction(_init)),
    'init hook - must be a function (or undefined)',
  )

  // FIXME:
  // invalid(
  //  !(_ctx === undefined || _ctx instanceof Ctx),
  //  'context - must be instance of `Ctx` class (or undefined)',
  // )

  const _depth = _deps.reduce(
    (acc, f, i) => (
      invalid(
        !getIsFuture(f),
        `future dependency #${i + 1} - must be a future too`,
      ),
      Math.max(acc + 1, getInternal(f)._depth)
    ),
    0,
  )

  function _lift(input: unknown, runCtx: RunCtx<Ctx, Future>) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    runCtx.queue.insert(_depth, me)

    lift(input, runCtx)
  }

  const _executor = {
    [_key](runCtx: RunCtx<Ctx, Future>) {
      invalid(runCtx instanceof RunCtx === false, 'runtime context')

      const { ctx, cache, queue } = runCtx

      const ref = ctx.getRef(_key) || new Ref()

      let result!: RunCache

      try {
        const value = executor(
          _deps.map(
            d =>
              cache.get(getInternal(d)._key) || new RunCache({ value: STOP }),
          ),
          ref,
          runCtx,
        )

        result = value instanceof RunCache ? value : new RunCache({ value })
      } catch (value) {
        result = new RunCache({ value, kind: 'error' })
      }

      if (result.kind !== 'stop') {
        ref.links.forEach(l => queue.insert(getInternal(l)._depth, l))
      }

      cache.set(_key, result)

      // iterating over queue may be described outer by a loop
      // but for better debugger inspection we increase call stack
      const next = queue.extract()

      if (next !== undefined) getInternal(next)._executor(runCtx)
    },
  }[_key]

  const me: Future<any, any> = assign(
    (input: unknown, runCtx?: RunCtx<Ctx, Future>): unknown => {
      if (runCtx === undefined) {
        runCtx = _ctx.dispatch(me, input)
      } else {
        _executor(runCtx)
      }

      // FIXME: assemble async output
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return filterStopUndef(runCtx!.cache.get(_key)!.value)
    },
    {
      [INTERNAL]: {
        _name,
        _key,
        _deps,
        _depth,
        _init,
        _ctx: () => {
          // FIXME: Types incompatible
          // Future[INTERNAL]._ctx: (runCtx: RunCtx) => void
          // _ctx => Ctx
        },
        _lift,
        _executor,
      },

      chain: ((opts: Fn | FutureOptions<any, any>) => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return futureChain(me, opts as any)
      }) as Future<any, any>['chain'],

      bind: (ctx: Ctx) => {
        return createSomeFuture({ ...options, name: _name, key: _key, ctx })
      },

      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      subscribe: (cb: Fn, ctx = _ctx): Fn<[], void> => ctx.subscribe(cb, me),

      toString() {
        return _key
      },
    },
  )

  return me
}

export function futureChain<T, Dep extends Future<any, any> | Atom<any, any>>(
  dep: Dep,
  executor: Fn<[ChainI<FnO<Dep>>, RefCache], T | RunCache<T>>,
): Future<FnI<Dep>, ChainO<Dep, T>>

export function futureChain<T, Dep extends Future<any, any> | Atom<any, any>>(
  dep: Dep,
  options: AtomOptions<ChainI<FnO<Dep>>, T>,
): Atom<FnI<Dep>, ChainO<Dep, T>>

export function futureChain<T, Dep extends Future<any, any> | Atom<any, any>>(
  dep: Dep,
  options: FutureOptions<ChainI<FnO<Dep>>, T>,
): Future<FnI<Dep>, ChainO<Dep, T>>

export function futureChain<T, Dep extends Future<any, any> | Atom<any, any>>(
  dep: Dep,

  executor:
    | Fn<[ChainI<FnO<Dep>>, RefCache], T | RunCache<T>>
    | AtomOptions<ChainI<FnO<Dep>>, T>
    | FutureOptions<ChainI<FnO<Dep>>, T>,
): Atom<FnI<Dep>, ChainO<Dep, T>> | Future<FnI<Dep>, ChainO<Dep, T>> {
  const { executor: _executor, ...restOptions } = getIsFunction(executor)
    ? { executor }
    : executor

  const isAtom = getIsAtomOptions(executor as any)

  invalid(!getIsFunction(_executor), 'executor - must be a function')

  const depInternal = getInternal(dep as any)

  const me = createSomeFuture({
    name: `-> ${depInternal._key}`,

    ...restOptions,

    deps: [dep as any],

    lift: (input, runCtx) => depInternal._lift(input, runCtx),

    executor: (inputs, ref) => {
      const input = inputs[0]

      const getter = isAtom
        ? ref.getCache((restOptions as AtomOptions<any, any>).defaultState)
        : ref.getCache
      // FIXME:
      // if (input.kind === 'error') _errorExecutor()

      let result =
        // eslint-disable-next-line no-nested-ternary
        input.kind === 'stop'
          ? STOP
          : input.kind === 'async'
          ? (input.value as any).then((v: any) =>
              _executor(v as ChainI<FnO<Dep>>, getter),
            )
          : _executor(input.value as ChainI<FnO<Dep>>, getter)

      result =
        result instanceof RunCache ? result : new RunCache({ value: result })

      if (isAtom && result.kind === 'payload') {
        const { rollback } = result
        ref.box.cache = result.value
        result = new RunCache({
          value: result.value,

          rollback: () => ((ref.box.cache = getter), rollback && rollback()),
        })
      }

      return result
    },
  } as SomeFutureOptions) as Future<FnI<Dep>, ChainO<Dep, T>>

  return me
}
