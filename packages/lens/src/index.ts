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
  throwReatomError,
} from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'
import { spyChange } from '@reatom/hooks'
import { isShallowEqual } from '@reatom/utils'

export * from './parseAtoms'
export * from './bind'
export * from './withReset'

type PipedAtom<T extends Atom> = T extends Action<any[], infer Payload>
  ? Action<[], Payload>
  : Atom<AtomState<T>>

const mapName = ({ __reatom: proto }: Atom, fallback: string, name?: string) =>
  proto.name ? `${proto.name}.${name ?? fallback}` : name

/**
 * Skip mark to stop reactive propagation and use previous state
 * (`never` helps to infer correct type)
 * @internal
 * @deprecated
 */
export const SKIP: never = 'REATOM_SKIP_MARK' as any as never

/** Remove callable signature to prevent the atom update from outside */
export const readonly = <T extends Atom>({
  __reatom,
  pipe,
}: T): Atom<AtomState<T>> => ({ __reatom, pipe })

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
  ): Fn<[T], Atom<Res>> =>
  (anAtom: Atom) =>
    atom(
      (ctx, state?: any) =>
        mapper(ctx, ctx.spy(anAtom), ctx.cause!.pubs.at(0)?.state, state),
      mapName(anAtom, 'mapState', name),
    )

/** Transform action payload */
export const mapPayload: {
  <T, Payload>(map: Fn<[Ctx, T], Payload>, name?: string): Fn<
    [Action<any[], T>],
    Action<[], Payload>
  >
  <T extends Action>(fallback: ActionPayload<T>, name?: string): Fn<
    [T],
    Atom<ActionPayload<T>>
  >
  <T, State>(fallback: State, name?: string): Fn<
    [Action<any[], T>],
    Atom<State | T>
  >
  <T, State>(fallback: State, map: Fn<[Ctx, T], State>, name?: string): Fn<
    [Action<any[], T>],
    Atom<State>
  >
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
                const payload = map(ctx, v.payload)
                return payload === SKIP
                  ? acc
                  : [...acc, { params: [v], payload }]
              }, prevState))
            : depState.reduce((acc, { payload }) => {
                const state = map(ctx, payload)
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

    return anAction.pipe(
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

/** Filter updates by comparator function ("shallow equal" by default) */
export const filter: {
  // TODO for some reason an atom not handled by the second overload
  // and fails with error on the frst overload.
  // <T>(predicate: Fn<[Ctx, T], boolean>, name?: string): Fn<
  //   [Action<any[], T>],
  //   T extends any ? Action<[], T> : never
  // >
  // <T>(predicate: Fn<[CtxSpy, T, T], boolean>, name?: string): Fn<
  //   [Atom<T>],
  //   Atom<T>
  // >
  <T extends Atom>(
    predicate?: T extends Action<any[], infer Payload>
      ? Fn<[CtxSpy, Payload], boolean>
      : Fn<[CtxSpy, AtomState<T>, AtomState<T>], boolean>,
    name?: string,
  ): Fn<[T], PipedAtom<T>>
} =
  (
    // @ts-expect-error
    predicate = (ctx, a, b) => isShallowEqual(a, b),
    name,
  ) =>
  (anAtom: Atom): any => {
    name ||= anAtom.__reatom.name && 'filter'

    return anAtom.pipe(
      // @ts-ignore
      anAtom.__reatom.isAction
        ? mapPayload(
            // @ts-ignore
            (ctx, payload) => (predicate(ctx, payload) ? payload : SKIP),
            name,
          )
        : mapState(
            (ctx, newState, oldState) =>
              ctx.cause!.pubs.length === 0 ||
              predicate(ctx, newState, oldState!)
                ? newState
                : oldState!,
            name,
          ),
    )
  }

/** Delay updates by timeout */
export const debounce =
  <T extends Atom>(timeout: number, name?: string): Fn<[T], PipedAtom<T>> =>
  // @ts-ignore
  (anAtom: Atom, name?: string) => {
    const { isAction } = anAtom.__reatom
    const cacheAtom = atom({ current: undefined as any })
    const theAtom = atom((ctx, prevState?: any) => {
      let state = ctx.spy(anAtom)
      if (isAction) state = anAtom.__reatom.patch!.state

      const cache = cacheAtom(ctx, { current: state })

      ctx.schedule(() =>
        setTimeout(
          () =>
            ctx.get(
              (r, a) =>
                ctx.get(cacheAtom) === cache &&
                a!(
                  ctx,
                  theAtom.__reatom,
                  (patchCtx: Ctx, patch: AtomCache) => (patch.state = state),
                ),
            ),
          timeout,
        ),
      )

      return ctx.cause.pubs.length ? prevState : state
    }, mapName(anAtom, 'debounce', name))
    theAtom.__reatom.isAction = isAction

    return theAtom
  }

/** Delay updates until other atom update / action call */
// https://rxjs.dev/api/operators/sample
// https://effector.dev/docs/api/effector/sample
export const sample =
  <T>(signal: Atom, name?: string): Fn<[Atom<T>], Atom<T>> =>
  // @ts-ignore
  (anAtom) => {
    throwReatomError(anAtom.__reatom.isAction, 'atom expected')

    return anAtom.pipe(
      mapState(
        (ctx, payload, prevPayload, prevState) =>
          spyChange(ctx, signal) || ctx.cause.pubs.length === 0
            ? payload
            : prevState,
        name || (anAtom.__reatom.name && 'filter'),
      ),
    )
  }

/** Convert action to atom with optional fallback state */
export const toAtom = <T, State = undefined | T>(
  fallback?: State,
  name?: string,
): Fn<[Action<any[], T>], Atom<State | T>> =>
  mapPayload(fallback, (ctx, v: any) => v, name)

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
