import {
  action,
  atom,
  Fn,
  Ctx,
  Action,
  Atom,
  AtomState,
  Unsubscribe,
} from '@reatom/core'
import { assign } from '@reatom/utils'
import { onConnect } from '@reatom/hooks'

export interface Route {
  path: string
  title: string
}

export interface History extends Array<Route> {}

export interface RouteAtom extends Atom<Route> {
  go: Action<[path: string | number, title?: string | undefined]>
  back: Action
  forward: Action
  historyAtom: Atom<History>
  positionAtom: Atom<number>
  // public adapter for DI purposes
  syncAtom: Atom<{
    go: Fn<[Ctx, string, string] | [Ctx, number, undefined]>
    subscribe: Fn<[ctx: Ctx, routeAtom: RouteAtom], Unsubscribe>
  }>
}

export const reatomNavigation = (
  sync: AtomState<RouteAtom['syncAtom']>,
): RouteAtom => {
  const syncAtom = atom(sync, `navigation.sync`)

  const historyAtom = atom<History>(
    [{ path: '', title: '' }],
    `navigation.history`,
  )
  onConnect(historyAtom, (ctx) =>
    ctx.get(syncAtom).subscribe(ctx, routeAtom as RouteAtom),
  )

  const positionAtom = atom(0, `navigation.position`)

  const routeAtom = atom(
    (ctx) => ctx.get(historyAtom).at(ctx.spy(positionAtom))!,
    `navigation.route`,
  )

  const go = action((ctx, path: number | string, title?: string) => {
    const history = ctx.get(historyAtom)
    const position = ctx.get(positionAtom)
    const sync = ctx.get(syncAtom)

    ctx.schedule(
      // @ts-ignore
      () => sync.go(ctx, path, title),
    )

    if (typeof path === 'number') {
      const fromRange = position
      const toRange = history.length - position
      const isFitToRange =
        path !== 0 && (path > 0 ? path < toRange : path * -1 < fromRange)
      if (!isFitToRange) {
        throw new RangeError(
          `Wrong navigation index "${path}" for position ${position}, history size ${history.length})`,
        )
      }
      positionAtom(ctx, path)
      return
    }

    title ??= history.at(position)!.title

    const { length } = historyAtom(ctx, (state) => {
      state = state.slice(0, position)
      state.push({ path, title: title as string })
      return state
    })
    positionAtom(ctx, length - 1)
  }, `navigation.go`)

  const back = action(
    (ctx) => positionAtom(ctx, (s) => Math.max(0, s - 1)),
    `navigation.back`,
  )
  const forward = action(
    (ctx) =>
      positionAtom(ctx, (s) =>
        Math.min(ctx.get(historyAtom).length - 1, s + 1),
      ),
    `navigation.forward`,
  )

  return assign(routeAtom, {
    go,
    back,
    forward,
    historyAtom,
    positionAtom,
    syncAtom,
  })
}
