import { action, atom } from '@reatom/core'
import { withReducers } from '@reatom/primitives'
import { shallowEqual, atomizeActionResult } from '@reatom/utils'

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
  const loadingAtom = atom(false, `${name}ResourceLoading`).pipe(
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

      if (isLast()) {
        onDone(ctx, newState)
      }

      return newState
    } catch (err) {
      err = err instanceof Error ? err : new Error(String(err))

      if (isLast()) {
        // @ts-expect-error
        onError(ctx, err)
      }

      throw err
    }
  }, `${name}Resource.refetch`)

  const refetchPromiseAtom = atomizeActionResult(refetch)

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
    dataAtom.__reatom.onConnect.add((ctx) => {
      // @ts-expect-error
      refetch(ctx)
    })
  }

  return {
    cancel,
    dataAtom,
    changeData: dataAtom,
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
