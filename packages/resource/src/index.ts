import { Action, action, Atom, atom, AtomMut } from '@reatom/core'
import { withReducers } from '@reatom/primitives'
import { shallowEqual } from '@reatom/utils'

export interface ResourceAtom<State, Params> extends AtomMut<State> {
  cancel: Action<[], void>
  errorAtom: Atom<null | Error>
  fetch: Action<[params: Params], Promise<State>>
  loadingAtom: Atom<boolean>
  onDone: Atom<Array<State>>
  onError: Atom<Array<Error>>
  refetch: Action<[params: Params], Promise<State>>
  retry: Action<[], Promise<State>>
}

export const atomizeResource = <State, Params>(
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
): ResourceAtom<State, Params> => {
  const initParams = Symbol() as any
  const paramsAtom = atom(initParams as Params, `${name}Params`)
  const versionAtom = atom(0)
  const dataAtom = atom(initState, `${name}Atom`)
  const loadingAtom = atom(false, `${name}LoadingAtom`).pipe(
    withReducers({
      start: () => true,
      end: () => false,
    }),
  )
  const errorAtom = atom<null | Error>(null, `${name}ResourceError`)

  const refetch = action(async (ctx, params: Params) => {
    paramsAtom(ctx, params)
    const version = versionAtom(ctx, (s) => s + 1)
    const isLast = () => version === ctx.get(versionAtom)

    loadingAtom.start(ctx)
    errorAtom(ctx, null)

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

  const refetchPromiseAtom = atom<null | Promise<State>>(null)
  ;(refetch.__reatom.onUpdate ??= new Set()).add((ctx, patch) =>
    refetchPromiseAtom(ctx, patch.state.at(-1)),
  )

  const fetch = action(async (ctx, params: Params): Promise<State> => {
    return isEqual(ctx.get(paramsAtom), params)
      ? ctx.get(loadingAtom)
        ? ctx.get(refetchPromiseAtom)!
        : ctx.get(dataAtom)
      : refetch(ctx, params)
  }, `${name}Resource.fetch`)

  const onDone = action((ctx, data: State): State => {
    loadingAtom.end(ctx)
    dataAtom(ctx, data)

    return data
  }, `${name}Resource.onDone`)

  const onError = action((ctx, err: Error): Error => {
    loadingAtom.end(ctx)
    errorAtom(ctx, err)

    return err
  }, `${name}Resource.onError`)

  const cancel = action((ctx): void => {
    loadingAtom.end(ctx)
    versionAtom(ctx, (s) => s + 1)
  }, `${name}Resource.cancel`)

  const retry = action((ctx): Promise<State> => {
    return refetch(ctx, ctx.get(paramsAtom))
  }, `${name}Resource.retry`)

  if (fetchOnInit) {
    ;(dataAtom.__reatom.onConnect ??= new Set()).add((ctx) => {
      // @ts-expect-error
      refetch(ctx)
    })
  }

  return Object.assign(dataAtom, {
    cancel,
    errorAtom,
    fetch,
    loadingAtom,
    onDone: { ...onDone },
    onError: { ...onError },
    refetch,
    retry,
  })
}
