import {
  Future,
  Collection,
  FutureInput,
  ChainInput,
  ChainedValue,
  CommonOptions,
  RunCtx,
} from '.'
import { STOP } from './common'

export type CombinedInput<
  Shape extends
    | [Future<any, any>]
    | Future<any, any>[]
    | Collection<Future<any, any>>
> = { [K in keyof Shape]: FutureInput<Shape[K]> }
export type CombinedOutput<
  Shape extends
    | [Future<any, any>]
    | Future<any, any>[]
    | Collection<Future<any, any>>
> = { [K in keyof Shape]: ChainInput<Shape[K]> | undefined }
export type AllOutput<
  Shape extends
    | [Future<any, any>]
    | Future<any, any>[]
    | Collection<Future<any, any>>
> = { [K in keyof Shape]: ChainInput<Shape[K]> }
// FIXME: promise is not infered
// export type FutureListOutput<
//   Shape extends Future<any, any>[] | Collection<Future<any, any>>
// > = _FutureListOutput<Shape> extends
//   | { [k: string]: Promise<any> }
//   | Promise<any>[]
//   ? Promise<_FutureListOutput<Shape>>
//   : _FutureListOutput<Shape>

export type RaceOutput<T> = ChainedValue<
  T extends Future<any, infer T>[] | Collection<Future<any, infer T>>
    ? T
    : never
>

export function combine<
  T extends
    | [Future<any, any>]
    | Future<any, any>[]
    | Collection<Future<any, any>>
>(
  futures: T,
  {
    ctx,
    init,
    name = `"Future.combine"`,
  }: CommonOptions<CombinedInput<T>, CombinedOutput<T>> = {},
): Future<CombinedInput<T>, CombinedOutput<T>> {
  const isArray = Array.isArray(futures)
  const keys = Object.keys(futures)
  const mapper = (input: any, cache: any, runCtx: RunCtx): any => {
    const result: any = isArray ? new Array(keys.length) : {}
    let hasPromises = false
    let last: any /* CombinedInput<T> */ = cache.last
    if (last === undefined) {
      last = cache.last = isArray ? new Array(keys.length) : {}
      keys.forEach(k => (last[k] = STOP))
    }

    for (let i = 0; i < keys.length; i++) {
      const key: any = keys[i]
      let value = input[i]
      if (value instanceof Promise) {
        hasPromises = true
      } else {
        if (
          value === STOP ||
          (value === undefined && !runCtx.payload.has(futures[key]))
        ) {
          value = last[key]
        }
        result[key] = last[key] = value
      }
    }

    return hasPromises
      ? Promise.all(input).then(() =>
          mapper(
            // @ts-ignore
            f._read(runCtx),
            cache,
            runCtx,
          ),
        )
      : result
  }
  const f = new Future({
    ctx,
    deps: keys.map((k: any) => futures[k]),
    init,
    name,
    mapper,
  })

  // @ts-ignore
  f._fork = (input: CombinedInput<T>, runCtx: RunCtx) =>
    // @ts-ignore
    keys.map((k: any) => futures[k]._fork(input[k], runCtx))

  f.fork = () => {
    throw new Error('Reatom: fork of combined future is not implemented')
  }

  return f
}

export function race<
  T extends Future<any, any>[] | Collection<Future<any, any>>
>(
  futures: T,
  {
    ctx,
    init,
    name = `"Future.race"`,
  }: CommonOptions<never, RaceOutput<T>> = {},
): Future<never, RaceOutput<T>> {
  const keys = Object.keys(futures)
  const f = combine(futures).chain(
    (payload: any, cache, runCtx) => {
      for (let i = 0; i < keys.length; i++) {
        const key: any = keys[i]
        if (runCtx.payload.has(futures[key])) return payload[key]
      }
      throw new Error('Reatom: unexpected `race` case.')
    },
    // FIXME: any
    { ctx, init, name } as any,
  )

  // @ts-ignore
  f._fork = () => {
    throw new Error('Reatom: fork of race is not implemented')
  }

  return f as any
}

export function all<
  T extends
    | [Future<any, any>]
    | Future<any, any>[]
    | Collection<Future<any, any>>
>(
  futures: T,
  {
    ctx,
    init,
    name = `"Future.all"`,
  }: CommonOptions<CombinedInput<T>, CombinedOutput<T>> = {},
): Future<CombinedInput<T>, CombinedOutput<T>> {
  const keys = Object.keys(futures)
  return combine<any>(futures, {
    ctx,
    init,
    name,
  }).chain((v: any) => {
    if (keys.some(k => v[k] === STOP)) return STOP
    return v
  })
}
