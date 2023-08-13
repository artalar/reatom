import {AsyncAction, reatomAsync} from '@reatom/async'
import {Plain} from '@reatom/utils'
import {
  TypedFetchInit,
  TypedFetchInitFn,
  TypedFetchMethod,
  TypedFetchInits,
  TYPED_FETCH_METHODS,
  typedFetch,
} from './typed-fetch'

export type ReatomFetchFactory<Args extends any[] = []> = {
  <T>(init?: TypedFetchInit<T>): ReatomFetchQuery<T, Args>
  <T, Arg>(init: TypedFetchInitFn<T, Arg>): ReatomFetchQuery<T, [...Args, Arg]>
}

export type ReatomFetchQuery<T, Args extends any[] = []> = AsyncAction<
  Args,
  T
> &
  Plain<Record<TypedFetchMethod | 'createFetch', ReatomFetchFactory<Args>>>

export const reatomFetch = <T, Args extends any[] = []>(
  ...inits: [init: TypedFetchInit<T>] | TypedFetchInits
) => {
  const query = reatomAsync((ctx, ...args: Args) =>
    typedFetch<T, Args>(...inits, {signal: ctx.controller.signal})(...args),
  )

  const factory =
    (method?: string) =>
      (init: any = {}) =>
        reatomFetch(...inits, init, {method})

  return Object.assign(
    query,
    {reatomFetch: factory()},
    Object.fromEntries(
      TYPED_FETCH_METHODS.map((method) => [method, factory(method)]),
    ),
  ) as any as ReatomFetchQuery<T, Args>
}
