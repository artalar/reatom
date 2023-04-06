import {
  action,
  Action,
  ActionPayload,
  atom,
  Atom,
  AtomCache,
  AtomMut,
  AtomState,
  Ctx,
  CtxParams,
  CtxSpy,
  Fn,
  IsAction,
  Rec,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'
import { onUpdate } from '@reatom/hooks'
import { isShallowEqual, noop } from '@reatom/utils'

export * from './bind'
export * from './parseAtoms'
export * from './withReset'

interface LensAtom<State = any> extends Atom<State> {
  deps: Array<Atom>
}
interface LensAction<Params extends any[] = any[], Payload = any>
  extends Action<Params, Payload> {
  deps: Array<Atom>
}

const mapName = ({ __reatom: proto }: Atom, operator: string, name?: string) =>
  name ?? `${proto.name}.${operator}`

/** Filter updates by comparator function ("shallow equal" for atoms by default) */
export const filter: {
  // TODO for some reason an atom not handled by overloads, if an action overload is first
  <T extends Atom>(
    predicate?: T extends Action<infer Params, infer Payload>
      ? Fn<[Ctx, Payload, Params], boolean>
      : Fn<[CtxSpy, AtomState<T>, AtomState<T>], boolean>,
    name?: string,
  ): Fn<
    [T],
    T extends Action<infer Params, infer Payload>
      ? LensAction<Params, Payload>
      : T extends Atom<infer State>
      ? LensAtom<State>
      : never
  >
} =
  (predicate?: Fn, name?: string) =>
  (anAtom: Atom): any => {
    name = mapName(anAtom, 'filter', name)
    const { isAction } = anAtom.__reatom

    predicate ??= isAction ? () => true : (ctx, a, b) => !isShallowEqual(a, b)

    // @ts-expect-error
    const theAtom: LensAtom & LensAction = atom((ctx, prevState?: any) => {
      const isInit = ctx.cause.pubs.length === 0
      const state = ctx.spy(anAtom)

      return isAction
        ? state.reduce(
            (acc: any, call: any) =>
              predicate!(ctx, call.payload, call.params) ? [call] : acc,
            prevState ?? [],
          )
        : isInit || predicate!(ctx, state, prevState)
        ? state
        : prevState
    })
    theAtom.deps = [anAtom]
    theAtom.__reatom.isAction = isAction

    return theAtom
  }

/** Delay updates by timeout */
// @ts-expect-error
export const debounce: {
  // TODO for some reason an atom not handled by overloads, if an action overload is first
  <T extends Atom>(timeout: number, name?: string): Fn<
    [T],
    T extends Action<infer Params, infer Payload>
      ? LensAction<Params, Payload>
      : T extends Atom<infer State>
      ? LensAtom<State>
      : never
  >
} = (timeout: number, name?: string) => (anAtom: Atom) => {
  const { isAction } = anAtom.__reatom
  // @ts-expect-error
  const theAtom: LensAtom & LensAction = atom((ctx, prevState?: any) => {
    const patch = ctx.cause
    const state = ctx.spy(anAtom)

    if (!isAction || state.length) {
      ctx.schedule(() =>
        setTimeout(
          () =>
            ctx.get((read, acualize) => {
              if (read(patch.proto) === patch) {
                {
                  acualize!(
                    ctx,
                    patch.proto,
                    (patchCtx: Ctx, patch: AtomCache) =>
                      (patch.state = isAction ? [state.at(-1)] : state),
                  )
                }
              }
            }),
          timeout,
        ),
      )
    }

    return patch.pubs.length ? prevState : isAction ? [] : state
  }, mapName(anAtom, 'debounce', name))
  theAtom.__reatom.isAction = isAction
  theAtom.deps = [anAtom]

  return theAtom
}

/** Delay updates until other atom update / action call */
// https://rxjs.dev/api/operators/sample
// https://effector.dev/docs/api/effector/sample
// @ts-expect-error
export const sample: {
  // TODO for some reason an atom not handled by overloads, if an action overload is first
  <T extends Atom>(signal: Atom, name?: string): Fn<
    [T],
    T extends Action<infer Params, infer Payload>
      ? LensAction<Params, Payload>
      : T extends Atom<infer State>
      ? LensAtom<State>
      : never
  >
} =
  <T>(signal: Atom, name?: string) =>
  // @ts-ignore
  (anAtom) => {
    name = mapName(anAtom, 'sample', name)
    const { isAction } = anAtom.__reatom
    const cacheAtom = atom<unknown>(null, `${name}._cacheAtom`)

    // @ts-expect-error
    const theAtom: LensAtom & LensAction = atom((ctx, prevState?: any) => {
      const patch = ctx.cause
      const isInit = patch.pubs.length === 0

      ctx.spy(anAtom, (v) => cacheAtom(ctx, isAction ? [v] : v))

      let changed = false
      ctx.spy(signal, () => (changed = true))

      if (changed && !(isInit && !signal.__reatom.isAction)) {
        const state = ctx.get(cacheAtom)
        // drop action cache
        cacheAtom(ctx, ctx.get(anAtom))
        return state
      }

      return isInit && !(signal.__reatom.isAction && changed)
        ? isAction
          ? []
          : ctx.get(anAtom)
        : changed
        ? ctx.get(cacheAtom)
        : prevState
    })
    theAtom.__reatom.isAction = isAction
    theAtom.deps = [anAtom, signal]

    return theAtom
  }

// @ts-expect-error
export const effect: {
  // TODO for some reason an atom not handled by overloads, if an action overload is first
  <T extends Atom, Res>(
    fn: T extends Action<infer Params, infer Payload>
      ? Fn<[Ctx, Awaited<Payload>, Params], Res>
      : Fn<[Ctx, AtomState<T>], Res>,
    name?: string,
  ): Fn<
    [T],
    T extends Action<infer Params, infer Payload>
      ? LensAction<
          [
            {
              params: [{ params: Params; payload: Awaited<Payload> }]
              payload: Awaited<Res>
            },
          ],
          Awaited<Res>
        >
      : LensAction<
          [{ params: [AtomState<T>]; payload: Awaited<Res> }],
          Awaited<Res>
        >
  >
} = (fn: Fn, name?: string) => (anAtom: Atom) => {
  const { isAction } = anAtom.__reatom
  // TODO better error handling
  // @ts-expect-error
  const theAtom: LensAtom & LensAction = atom((ctx, state = []) => {
    const resolve = (params: any[], payload: any) =>
      ctx.get((read, acualize) => {
        if (payload instanceof Promise) {
          payload.then((payload) => resolve(params, payload))
        } else {
          acualize!(ctx, ctx.cause.proto, (patchCtx: Ctx, patch: AtomCache) => {
            patch.state = [{ params, payload }]
          })
        }
      })

    ctx.spy(anAtom, (value) => {
      if (isAction && value.payload instanceof Promise) {
        __thenReatomed(ctx, value.payload, (payload) =>
          ctx.schedule(() =>
            resolve(
              [{ params: value.params, payload }],
              fn(ctx, payload, value.params),
            ),
          ),
        )
      } else {
        ctx.schedule(() =>
          resolve(
            [value],
            isAction ? fn(ctx, value.payload, value.params) : fn(ctx, value),
          ),
        )
      }
    })

    return state ?? []
  }, mapName(anAtom, 'effect', name))
  theAtom.__reatom.isAction = true
  theAtom.deps = [anAtom]

  return theAtom
}

type Combined<Shape extends Rec<Atom>> = {
  [K in keyof Shape]: AtomState<Shape[K]>
}

export const combine = <Shape extends Rec<Atom>>(
  shape: Shape,
): LensAtom<Combined<Shape>> => {
  // @ts-expect-error
  const theAtom: LensAtom = atom((ctx, state = {} as Combined<Shape>) => {
    const newState = {} as Combined<Shape>
    for (const key in shape) newState[key] = ctx.spy(shape[key]!)
    return isShallowEqual(state, newState) ? state : newState
  })
  theAtom.deps = Object.values(shape)

  return theAtom
}

/**
 * Skip mark to stop reactive propagation and use previous state
 * (`never` helps to infer correct type)
 * @internal
 * @deprecated
 */
export const SKIP: never = 'REATOM_SKIP_MARK' as any as never

/** Remove callable signature to prevent the atom update from outside */
export const readonly = <T extends Atom & { deps?: Array<Atom> }>({
  __reatom,
  pipe,
  deps,
}: T): Atom<AtomState<T>> =>
  Object.assign(
    {
      __reatom,
      pipe,
    },
    deps ? { deps } : {},
  )

/** Remove all extra properties from the atom to pick the essence */
export const plain = <T extends Atom>(
  anAtom: T,
): T extends Action<infer Params, infer Payload>
  ? Action<Params, Payload>
  : T extends AtomMut<infer State>
  ? AtomMut<State>
  : Atom<AtomState<T>> => {
  const theAtom =
    typeof anAtom === 'function'
      ? // @ts-expect-error
        anAtom.bind()
      : {}
  theAtom.__reatom = anAtom.__reatom
  theAtom.pipe = anAtom.pipe

  return theAtom
}

/** Transform atom state */
export const mapState =
  <T extends Atom, Res>(
    mapper: Fn<[CtxSpy, AtomState<T>, undefined | AtomState<T>, unknown], Res>,
    name?: string,
  ): Fn<[T], LensAtom<Res>> =>
  (anAtom: Atom) => {
    // @ts-expect-error
    const theAtom: LensAtom = atom(
      (ctx, state?: any) =>
        mapper(ctx, ctx.spy(anAtom), ctx.cause!.pubs.at(0)?.state, state),
      mapName(anAtom, 'mapState', name),
    )
    theAtom.deps = [anAtom]

    return theAtom
  }

/** Transform action payload */
export const mapPayload: {
  <Payload, T, Params extends any[] = any[]>(
    map: Fn<[Ctx, Payload, Params], T>,
    name?: string,
  ): Fn<[Action<Params, Payload>], Action<[], T>>
  <T extends Action>(fallback: ActionPayload<T>, name?: string): Fn<
    [T],
    Atom<ActionPayload<T>>
  >
  <T, State>(fallback: State, name?: string): Fn<
    [Action<any[], T>],
    Atom<State | T>
  >
  <Payload, State, Params extends any[] = any[]>(
    fallback: State,
    map: Fn<[Ctx, Payload, Params], State>,
    name?: string,
  ): Fn<[Action<Params, Payload>], Atom<State>>
} =
  (fallbackOrMapper: any, mapOrName?: any, name?: string) =>
  (anAction: Action): any => {
    throwReatomError(!anAction.__reatom.isAction, 'action expected')

    const isAction = typeof fallbackOrMapper === 'function'
    // isAtom
    let fallback = fallbackOrMapper
    // isAtom
    let map = mapOrName ?? ((ctx: Ctx, v: any) => v)
    if (isAction) {
      fallback = []
      map = fallbackOrMapper
      name = mapOrName
    }

    const theAtom = Object.assign(
      () => throwReatomError(1, 'derived action call'),
      anAction.pipe(
        mapState((ctx, depState, prevDepState, prevState = fallback) => {
          return isAction
            ? // @ts-expect-error
              ((ctx.spy = undefined),
              depState.reduce((acc: any, v) => {
                const payload = map(ctx, v.payload, v.params)
                return payload === SKIP
                  ? acc
                  : [...acc, { params: [v], payload }]
              }, prevState))
            : depState.reduce((acc, { payload, params }) => {
                const state = map(ctx, payload, params)
                return state === SKIP ? acc : state
              }, prevState)
        }, name || (anAction.__reatom.name && 'mapPayload')),
      ),
    )
    theAtom.__reatom.isAction = isAction

    return theAtom
  }

/** Transform async action payload */
export const mapPayloadAwaited: {
  <T, Payload = Awaited<T>>(
    mapper: Fn<[Ctx, Awaited<T>], Payload>,
    name?: string,
  ): Fn<[Action<any[], T>], Action<[], Payload>>
  <T extends Action>(fallback: Awaited<ActionPayload<T>>, name?: string): Fn<
    [T],
    Atom<Awaited<ActionPayload<T>>>
  >
  <T, State>(fallback: State, name?: string): Fn<
    [Action<any[], T>],
    Atom<State | Awaited<T>>
  >
  <T, State>(
    fallback: State,
    map: Fn<[Ctx, Awaited<T>], State>,
    name?: string,
  ): Fn<[Action<any[], T>], Atom<State>>
} =
  (...a: [any?, any?, any?]) =>
  (anAction: Action): any => {
    const isAction = a.length === 0 || typeof a[0] === 'function'
    const [fallback, map = (ctx: Ctx, v: any) => v, name] = isAction
      ? [[], a[0], a[1]]
      : a
    const params = isAction ? [] : [fallback]
    params.push((ctx: Ctx, promise: any) => {
      if (promise instanceof Promise) {
        __thenReatomed(ctx, promise, (v, read, actualize) =>
          actualize!(
            ctx,
            ctx.cause!.proto,
            (patchCtx: Ctx, patch: AtomCache) => {
              patch.cause = ctx.cause.cause
              const payload = map(ctx, v)
              patch.state = isAction
                ? [...patch.state, { params: [v], payload }]
                : payload
            },
          ),
        )

        return SKIP
      } else {
        return map(ctx, promise)
      }
    }, name || (anAction.__reatom.name && 'mapPayloadAwaited'))

    // @ts-expect-error reatomAsync
    return (anAction.onFulfill ?? anAction).pipe(
      mapPayload(
        // @ts-ignore
        ...params,
      ),
    )
  }

/** Transform atom update */
export const mapInput =
  <T extends AtomMut | Action<[any]>, Args extends [Ctx, ...any[]]>(
    mapper: Fn<Args, Parameters<T>[1]>,
    name?: string,
  ): Fn<[T], Action<CtxParams<Args>, AtomState<T>>> =>
  (anAtom): any =>
    action(
      (ctx, ...args) =>
        anAtom(
          ctx,
          // @ts-ignore
          mapper(ctx, ...args),
        ),
      mapName(anAtom, 'mapInput', name),
    )

/** Convert action to atom with optional fallback state */
export const toAtom: {
  <T extends Action>(fallback: ReturnType<T>, name?: string): Fn<
    [T],
    Atom<ReturnType<T>>
  >
  <T extends Action>(fallback?: undefined, name?: string): Fn<
    [T],
    Atom<undefined | ReturnType<T>>
  >
  <T extends Action, State>(fallback: State, name?: string): Fn<
    [T],
    Atom<State | ReturnType<T>>
  >
} = (fallback?: any, name?: string): Fn<[Action], Atom> =>
  mapPayload(fallback, (ctx, v: any) => v, name)

// https://rxjs.dev/api/operators/tap
export const withOnUpdate =
  <T extends Atom>(
    cb: T extends Action<infer Params, infer Payload>
      ? Fn<
          [
            Ctx,
            Payload,
            AtomCache<AtomState<Action<Params, Payload>>> & { params: Params },
          ]
        >
      : Fn<[Ctx, AtomState<T>, AtomCache<AtomState<T>>]>,
  ) =>
  (anAtom: T): T => {
    onUpdate(anAtom, cb)
    return anAtom
  }

/** Convert an atom to action */
export const toAction =
  <T>(name?: string): Fn<[Atom<T>], LensAction<[T], T>> =>
  (anAtom) => {
    throwReatomError(anAtom.__reatom.isAction, 'atom expected')

    // @ts-expect-error
    const theAction: LensAction<[T], T> = atom((ctx) => {
      const state = ctx.spy(anAtom)
      return [{ params: [state], payload: state }]
    }, mapName(anAtom, 'toAction', name))
    theAction.__reatom.isAction = true
    theAction.deps = [anAtom]

    return theAction
  }

export const onDeepUpdate: typeof onUpdate = (anAtom: Atom, fn: Fn) =>
  ((anAtom as LensAtom).deps ?? []).reduce((acc, dep) => {
    const un = onDeepUpdate(dep, (ctx) => {
      ctx.get(anAtom)
    })
    return () => {
      un()
      acc()
    }
  }, onUpdate(anAtom, fn) as Unsubscribe)

// type StatesShape<Shape extends Rec<Atom>> = {
//   [K in keyof Shape]: AtomState<Shape[K]>
// }
// export const unstable_weakAtom = <Shape extends Rec<Atom>, State>(
//   shape: Shape,
//   reducer: Fn<[Ctx, StatesShape<Shape>], State>,
//   name?: string,
// ): Atom<StatesShape<Shape>> => {
//   const theAtom = atom((ctx) => {
//     const state = {} as StatesShape<Shape>
//     for (const key in shape) state[key] = ctx.spy(shape[key]!)
//     return state
//   }, name)

//   for (const name in shape) {
//     addOnUpdate(shape[name]!, (ctx) => ctx.schedule(() => ctx.get(theAtom), 0))
//   }

//   return theAtom
// }

// TODO
// mapDebounced, mapThrottled
