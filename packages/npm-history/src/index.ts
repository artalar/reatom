import { History, Location, To, Blocker, createMemoryHistory } from 'history'

import { action, atom, Atom, Action, throwReatomError } from '@reatom/core'
import { onUpdate } from '@reatom/hooks'
import { isShallowEqual } from '@reatom/utils'

export interface LocationAtom extends Atom<Location> {
  push: Action<[to: To, state?: any]>
  replace: Action<[to: To, state?: any]>
  go: Action<[delta: number]>
  back: Action<[]>
  forward: Action<[]>
  block: Action<[blocker: Blocker], () => void>
}

const historyAtom = atom<null | History>(null, 'historyAtom')

const _locationAtom = atom((ctx): Location => {
  const history = ctx.spy(historyAtom)

  throwReatomError(!history, 'history not initialized')

  let { location } = history!

  const locationUpdate = ctx.spy(updateLocation)
  if (locationUpdate.length) {
    location = locationUpdate[locationUpdate.length - 1]!.payload
  }

  return Object.assign({}, location)
}, 'locationAtom')

const updateLocation = action<Location>('updateLocation')

const push = action((ctx, to: To, state?: any) => {
  ctx.schedule(() => ctx.get(historyAtom)!.push(to, state))
  const history = createMemoryHistory({
    initialEntries: [Object.assign({}, ctx.get(_locationAtom))],
  })
  history.push(to, state)
  updateLocation(ctx, history.location)
}, 'historyAtom.push')

const replace = action((ctx, to: To, state?: any) => {
  ctx.schedule(() => ctx.get(historyAtom)!.replace(to, state))
  const history = createMemoryHistory({
    initialEntries: [Object.assign({}, ctx.get(_locationAtom))],
  })
  history.replace(to, state)
  updateLocation(ctx, history.location)
}, 'historyAtom.replace')

const go = action((ctx, delta: number) => {
  ctx.schedule(() => ctx.get(historyAtom)!.go(delta))
  const history = createMemoryHistory({
    initialEntries: [Object.assign({}, ctx.get(_locationAtom))],
  })
  history.go(delta)
  updateLocation(ctx, history.location)
}, 'historyAtom.go')

const back = action((ctx) => {
  ctx.schedule(() => ctx.get(historyAtom)!.back())
  const history = createMemoryHistory({
    initialEntries: [Object.assign({}, ctx.get(_locationAtom))],
  })
  history.back()
  updateLocation(ctx, history.location)
}, 'historyAtom.back')

const forward = action((ctx) => {
  ctx.schedule(() => ctx.get(historyAtom)!.forward())
  const history = createMemoryHistory({
    initialEntries: [Object.assign({}, ctx.get(_locationAtom))],
  })
  history.forward()
  updateLocation(ctx, history.location)
}, 'historyAtom.forward')

const block = action((ctx, blocker: Blocker) => {
  ctx.schedule(() => ctx.get(historyAtom)!.block(blocker))
  const history = createMemoryHistory({
    initialEntries: [Object.assign({}, ctx.get(_locationAtom))],
  })
  history.block(blocker)
  updateLocation(ctx, history.location)
}, 'historyAtom.block')

const locationAtom: LocationAtom = Object.assign(_locationAtom, {
  push,
  replace,
  go,
  back,
  forward,
  block,
})

onUpdate(historyAtom, (ctx, history) => {
  // FIXME clone
  internalHistoryAtom(ctx, [history])
})
onUpdate(historyAtom, (ctx, history) => {
  throwReatomError(!history, 'history not initialized')

  ctx.schedule(() =>
    history!.listen(({ location, action }) => {
      if (!isShallowEqual(ctx.get(_locationAtom), location)) {
        updateLocation(ctx, location)
      }
    }),
  )
})

export { historyAtom, locationAtom }

// let pathPieces = parsePath('/the/path?the=query#the-hash')
// // pathPieces = {
// //   pathname: '/the/path',
// //   search: '?the=query',
// //   hash: '#the-hash'
// // }

// export interface LocationPathAtom extends Atom<string> {
//   change: Action<[string]>
// }

// export const reatomLocation = ({
//   scheduler = globalThis.requestAnimationFrame ??
//     ((resolve) => setTimeout(resolve, 16)),
// }: { scheduler?: Fn<[Fn]> } = {}): LocationPathAtom => {
//   const locationPathAtom = atom('/', 'locationPathAtom').pipe(
//     withInit(() => globalThis.location.pathname),
//   )
//   onConnect(locationPathAtom, async (ctx) => {
//     do {
//       await new Promise(scheduler)
//       if (location.pathname !== ctx.get(locationPathAtom)) {
//         locationPathAtom(ctx, location.pathname)
//       }
//     } while (ctx.isConnected())
//   })
//   const change = action((ctx, path: string) => {
//     locationPathAtom(ctx, path)
//     ctx.schedule(() => {
//       // location.pathname = path
//       history.pushState({}, document.title, path)
//     })
//   }, 'locationPathAtom.change')

//   return Object.assign(locationPathAtom, { change })
// }

// export interface IsRouteAtom<Route extends string | RegExp>
//   extends Atom<boolean> {
//   path: Route
//   go: Route extends string ? Action<[], void> : never
// }

// export const reatomRoutes = <T extends Rec<string | RegExp>>(
//   locationPathAtom: LocationPathAtom,
//   routes: T,
// ): {
//   [K in keyof T as `${K}Atom`]: IsRouteAtom<T[K]>
// } => {
//   const res: Rec = {}
//   for (const k in routes) {
//     const name = `${k}Atom`
//     const route = routes[k]
//     const routeAtom = atom((ctx) => {
//       const path = ctx.spy(locationPathAtom)
//       const match =
//         route instanceof RegExp ? route.test(path) : path.startsWith(route)
//       return match
//     }, name)
//     res[name] = routeAtom
//     // @ts-expect-error
//     routeAtom.go = action((ctx) => {
//       throwReatomError(route instanceof RegExp, 'string route expected')
//       locationPathAtom.change(ctx, route as string)
//     }, `${name}.go`)
//   }

//   return res as any
// }

// export const locationPathAtom = reatomLocation()
// export const routes = reatomRoutes(locationPathAtom, {
//   home: '/main',
//   login: '/auth/login',
//   register: '/auth/register',
// })
