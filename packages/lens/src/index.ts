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
  Fn,
  throwReatomError,
} from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'

export * from './parseAtoms'
export * from './bind'

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
    mapper: Fn<[Ctx, AtomState<T>, undefined | AtomState<T>, unknown], Res>,
    name?: string,
  ): Fn<[T], Atom<Res>> =>
  (anAtom: Atom) =>
    atom(
      (ctx, state?: any) =>
        mapper(ctx, ctx.spy(anAtom), ctx.cause!.pubs.at(0)?.state, state),
      mapName(anAtom, 'mapState', name),
    )

/** Transform action payload */
export const mapPayload =
  <T extends Action, Res>(
    mapper: Fn<[Ctx, ReturnType<T>], Res>,
    name?: string,
  ): Fn<[T], Action<[], Res>> =>
  (anAction): any => {
    throwReatomError(!anAction.__reatom.isAction, 'action expected')

    const theAction = Object.assign(
      () => throwReatomError(1, 'derived action call'),
      anAction.pipe(
        mapState((ctx, depState, prevDepState, prevState = []) => {
          const newState = depState
            .map((v) =>
              v === SKIP
                ? SKIP
                : { params: [v], payload: mapper(ctx, v.payload) },
            )
            .filter((v) => v !== SKIP && v.payload !== SKIP)

          return newState.length === 0
            ? prevState
            : (prevState as any[]).concat(newState)
        }, name || (anAction.__reatom.name && 'mapPayload')),
      ),
    )
    theAction.__reatom.isAction = true

    return theAction
  }

/** Transform async action payload */
export const mapPayloadAwaited =
  <T extends Action, Res = Awaited<ActionPayload<T>>>(
    mapper: Fn<[Ctx, Awaited<ActionPayload<T>>], Res> = (ctx, v) => v,
    name?: string,
  ): Fn<[T], Action<[], Res>> =>
  (anAction): any =>
    anAction.pipe(
      mapPayload((ctx, promise: any) => {
        if (promise instanceof Promise) {
          __thenReatomed(ctx, promise, (v, read, actualize) =>
            actualize!(
              ctx,
              ctx.cause!.proto,
              (patchCtx: Ctx, patch: AtomCache) => {
                patch.cause = ctx.cause!.cause
                patch.state = patch.state.concat([
                  { params: [v], payload: mapper(ctx, v) },
                ])
              },
            ),
          )
          return SKIP
        } else {
          return mapper(ctx, promise)
        }
      }, name || (anAction.__reatom.name && 'mapPayloadAwaited')),
    )

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
      name || (anAtom.__reatom.name && 'mapInput'),
    )

/** Filter atom updates */
export const filter =
  <T extends Atom>(
    predicate: T extends Action<any, T>
      ? Fn<[T, T], boolean>
      : Fn<[AtomState<T>, AtomState<T>], boolean>,
    name?: string,
  ): Fn<[T], T> =>
  (anAtom) =>
    // @ts-ignore
    anAtom.pipe(
      mapState(
        (ctx, newState, oldState) =>
          ctx.cause!.pubs.length === 0 || predicate(newState, oldState!)
            ? newState
            : oldState!,
        name || (anAtom.__reatom.name && 'filter'),
      ),
    )

/** Convert action to atom with optional fallback state */
export const toAtom =
  <T, State = undefined | T>(
    fallback?: State,
    name?: string,
  ): Fn<[Action<any[], T>], Atom<State | T>> =>
  (anAction): any => {
    throwReatomError(!anAction.__reatom.isAction, 'action expected')

    return Object.assign(
      {},
      anAction,
      atom(
        (ctx, state = fallback) =>
          ctx.spy(anAction).reduce(
            (acc, v) =>
              // @ts-ignore
              v.payload,
            state,
          ),
        name || (anAction.__reatom.name && 'toAtom'),
      ),
    )
  }

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
