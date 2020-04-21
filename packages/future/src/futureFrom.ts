import { createSomeFuture, SomeFutureOptions } from './createSomeFuture'
import {
  Atom,
  AtomOptions,
  Future,
  FutureOptions,
  getInternal,
  getIsAtomOptions,
} from './Future'
import { RunCache } from './RunCache'
import { getIsFunction } from './shared'
import { Fn, GetCache } from './types'

export function futureFrom<I, O = I>(
  executor: Fn<[I, GetCache], O | RunCache<O>>,
): Future<I, O>
export function futureFrom<I, O = I>(options: AtomOptions<I, O>): Atom<I, O>
export function futureFrom<I, O = I>(options: FutureOptions<I, O>): Future<I, O>
export function futureFrom<I, O = I>(
  options: Fn<[I, GetCache], O> | AtomOptions<I, O> | FutureOptions<I, O>,
): Future<I, O> | Atom<I, O> {
  options = (getIsFunction(options) ? { executor: options } : options) as
    | AtomOptions<I, O>
    | FutureOptions<I, O>

  const { executor } = options
  const isAtom = getIsAtomOptions(options)

  const f = createSomeFuture({
    name: 'futureFrom',

    ...options,

    deps: [],

    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    lift: (value, runCtx) => runCtx.cache.set(_key, new RunCache({ value })),

    executor: (_, ref, runCtx) => {
      const getter = isAtom
        ? ref.getCache((options as AtomOptions<any, any>).defaultState)
        : ref.getCache

      // eslint-disable-next-line @typescript-eslint/no-use-before-define, @typescript-eslint/no-non-null-assertion
      let result = executor(runCtx.cache.get(_key)!.value as I, getter)

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
  } as SomeFutureOptions)

  const { _key } = getInternal(f)

  return f as Future<I, O> | Atom<I, O>
}
