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
  Rec,
  throwReatomError,
} from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'
import { onUpdate } from '@reatom/hooks'
import { Plain } from '@reatom/utils'
import { mapName } from './utils'

export * from './bind'
export * from './delay'
export * from './effect'
export * from './filter'
export * from './onLensUpdate'
export * from './parseAtoms'
export * from './sample'
export * from './withReset'

export interface LensAtom<State = any> extends Atom<State> {
  deps: Array<Atom>
}
export interface LensAction<Params extends any[] = any[], Payload = any>
  extends Action<Params, Payload> {
  deps: Array<Atom>
}

type Combined<Shape extends Rec<Atom>> = Plain<{
  [K in keyof Shape]: AtomState<Shape[K]>
}>

export const combine = <Shape extends Rec<Atom>>(
  shape: Shape,
): LensAtom<Combined<Shape>> => {
  // @ts-expect-error
  const theAtom: LensAtom = atom((ctx) => {
    const newState = {} as Combined<Shape>
    for (const key in shape) newState[key] = ctx.spy(shape[key]!)
    return newState
  }, '_combine')
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
}: T): LensAtom<AtomState<T>> =>
  Object.assign(
    {
      __reatom,
      pipe,
    },
    deps ? { deps } : {},
  ) as LensAtom<AtomState<T>>

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
    mapper: (
      ctx: CtxSpy,
      atomState1: AtomState<T>,
      atomState2: undefined | AtomState<T>,
      state: unknown,
    ) => Res,
    name?: string,
  ): ((atom: T) => LensAtom<Res>) =>
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
    map: (ctx: Ctx, payload: Payload, params: Params) => T,
    name?: string,
  ): (action: Action<Params, Payload>) => LensAction<[], T>

  <T extends Action>(fallback: ActionPayload<T>, name?: string): (
    action: T,
  ) => LensAtom<ActionPayload<T>>

  <T, State>(fallback: State, name?: string): (
    action: Action<any[], T>,
  ) => LensAtom<State | T>

  <Payload, State, Params extends any[] = any[]>(
    fallback: State,
    map: (ctx: Ctx, payload: Payload, params: Params, state: State) => State,
    name?: string,
  ): (action: Action<Params, Payload>) => LensAtom<State>
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
                const state = map(ctx, payload, params, acc)
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
    mapper?: (ctx: Ctx, prevState: Awaited<T>) => Payload,
    name?: string,
  ): (action: Action<any[], T>) => LensAction<[], Payload>

  <T extends Action>(fallback: Awaited<ActionPayload<T>>, name?: string): (
    action: T,
  ) => LensAtom<Awaited<ActionPayload<T>>>

  <T, State>(fallback: State, name?: string): (
    action: Action<any[], T>,
  ) => LensAtom<State | Awaited<T>>

  <T, State>(
    fallback: State,
    map: (ctx: Ctx, prevState: Awaited<T>) => State,
    name?: string,
  ): (action: Action<any[], T>) => LensAtom<State>
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
    mapper: (...args: Args) => Parameters<T>[1],
    name?: string,
  ): ((atom: T) => Action<CtxParams<Args>, AtomState<T>>) =>
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
// @ts-expect-error
export const toAtom: {
  <T extends Action>(fallback: ReturnType<T>, name?: string): (
    action: T,
  ) => LensAtom<ReturnType<T>>

  <T extends Action>(fallback?: undefined, name?: string): (
    action: T,
  ) => LensAtom<undefined | ReturnType<T>>
  <T extends Action, State>(fallback: State, name?: string): (
    action: T,
  ) => LensAtom<State | ReturnType<T>>
} =
  (fallback?: any, name?: string): ((action: Action) => Atom) =>
  (anAction) =>
    mapPayload(
      fallback,
      (ctx, v: any) => v,
      mapName(anAction, 'toAtom', name),
    )(anAction)

// https://rxjs.dev/api/operators/tap
export const withOnUpdate =
  <T extends Atom>(
    cb: T extends Action<infer Params, infer Payload>
      ? (
          ctx: Ctx,
          payload: Payload,
          cache: AtomCache<AtomState<Action<Params, Payload>>> & {
            params: Params
          },
        ) => any
      : (
          ctx: Ctx,
          cache1: AtomState<T>,
          cache2: AtomCache<AtomState<T>>,
        ) => any,
  ) =>
  (anAtom: T): T => {
    onUpdate(anAtom, cb)
    return anAtom
  }

/** Convert an atom to action */
export const toAction: {
  <State, T>(map: (ctx: Ctx, state: State) => T, name?: string): (atom: Atom<State>) =>
    LensAction<[State], T>
  
  <T>(name?: string): (atom: Atom<T>) => LensAction<[T], T>
} = (map?: string | ((...args: any[]) => any), name?: string) => (anAtom: Atom) => {
  throwReatomError(anAtom.__reatom.isAction, 'atom expected')

  if (typeof map === 'string') {
    name = map
    map = undefined
  }
  map ??= (ctx: Ctx, v: any) => v

  // @ts-expect-error
  const theAction: LensAction<[T], T> = atom((ctx) => {
    // TODO handle atom mutation in the same transaction
    const isInit = ctx.cause.pubs.length === 0
    const state = ctx.spy(anAtom)
    return isInit ? [] : [{ params: [state], payload: (map as ((...args: any[]) => any))(ctx, state) }]
  }, mapName(anAtom, 'toAction', name))
  theAction.__reatom.isAction = true
  theAction.deps = [anAtom]

  return theAction
}
