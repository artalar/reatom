import {
  Action,
  ActionIs,
  ActionResult,
  atom,
  Atom,
  AtomCache,
  AtomMut,
  AtomReturn,
  AtomState,
  Ctx,
  CtxLessParams,
  Fn,
  throwReatomError,
} from '@reatom/core'
import { onUpdate } from '@reatom/hooks'

declare const NEVER: unique symbol
type NEVER = typeof NEVER

// This type only need to omit empty `{}` for an atom without extra properties
export type AtomMap<
  T extends Atom,
  State = AtomState<T>,
  Args extends any[] = CtxLessParams<T, NEVER[]>,
> = AtomProperties<T> extends never
  ? AtomMapCallable<T, State, Args>
  : AtomMapCallable<T, State, Args> & {
      [K in AtomProperties<T>]: T[K]
    }

type AtomProperties<T> = keyof Omit<T, '__reatom' | 'pipe'>

type AtomMapCallable<
  T extends Atom,
  State = AtomState<T>,
  Args extends any[] = CtxLessParams<T, NEVER[]>,
> = ActionIs<T> extends true
  ? Action<Args, State>
  : T extends AtomMut<AtomState<T>, any>
  ? AtomMut<State, Args>
  : Atom<State>

const getAtomBlank = (
  parentAtom: Atom | AtomMut | Action,
  derivedAtom?: Atom,
): {} =>
  derivedAtom && typeof parentAtom === 'function'
    ? (ctx: Ctx, ...a: any[]) =>
        // @ts-ignore
        ctx.get(() => (parentAtom(ctx, ...a), ctx.get(derivedAtom)))
    : {}

/** Remove callable signature to prevent the atom update from outside (with all properties saving)  */
export const readonly = <T extends Atom>(
  anAtom: T,
): AtomMap<T, AtomState<T>, NEVER[]> => Object.assign<any, any>({}, anAtom)

/** Remove all extra properties from the atom to pick the essence (with callable signature saving) */
export const plain = <T extends Atom>(anAtom: T): AtomMapCallable<T> =>
  Object.assign(getAtomBlank(anAtom) as any, {
    __reatom: anAtom.__reatom,
    pipe: anAtom.pipe,
  })

/** Transform atom state (with all properties and callable signature saving) */
export const mapState =
  <T extends Atom, Res>(
    mapper: Fn<[Ctx, AtomState<T>, undefined | AtomState<T>], Res>,
    name?: string,
  ): Fn<[T], AtomMap<T, Res>> =>
  (anAtom: Atom): any => {
    const theAtom = atom(
      (ctx) => mapper(ctx, ctx.spy(anAtom), ctx.cause!.parents.at(0)?.state),
      name,
    )
    theAtom.__reatom.isAction = anAtom.__reatom.isAction

    return Object.assign(getAtomBlank(anAtom, theAtom), anAtom, theAtom)
  }

/** Get atom (with all properties saving) with resolved action value in state */
// FIXME: wrong return type
export const mapAsync =
  <T extends Action, Res = Awaited<ActionResult<T>>>(
    mapper: Fn<[Ctx, Awaited<ActionResult<T>>], Res> = (ctx, v) => v,
    name?: string,
  ): Fn<[T], AtomMap<T, Awaited<Res>>> =>
  (anAction): any => {
    throwReatomError(!anAction.__reatom.isAction, 'action expected')

    const theAtom = atom((ctx, state: any[] = []) => {
      for (const promise of ctx.spy(anAction)) {
        if (promise instanceof Promise) {
          promise.then(
            (v) =>
              ctx.get((read, actualize) =>
                actualize!(
                  ctx,
                  ctx.cause!.meta,
                  (patchCtx: Ctx, patch: AtomCache) => {
                    patch.cause = ctx.cause!.cause
                    patch.state = [...state, mapper(ctx, v)]
                  },
                ),
              ),
            () => {},
          )
        } else {
          state = [...state, mapper(ctx, promise)]
        }
      }

      return state
    }, name)
    theAtom.__reatom.isAction = true

    return Object.assign(anAction.bind(null), anAction, theAtom)
  }

/** Transform atom update payload (with all properties saving) */
// TODO type inference broken on without explicit Ctx return (currently described by `Parameters<T>`)
export const mapInput =
  <T extends AtomMut | Action, Args extends [Ctx, ...any[]]>(
    mapper: Fn<Args, Parameters<T>>,
  ): Fn<[T], AtomMap<T, AtomState<T>, CtxLessParams<Args>>> =>
  (anAtom): any =>
    Object.assign(
      // @ts-ignore
      (ctx: Ctx, ...args: Args) => anAtom(...mapper(ctx, ...args)),
      anAtom,
    )

/** Filter atom updates (with all properties saving) */
export const filter = <T extends Atom>(
  predicate: T extends Action<any, T>
    ? Fn<[T, T], boolean>
    : Fn<[AtomState<T>, AtomState<T>], boolean>,
  // TODO: how to mark to use the same name?
  name?: string,
): Fn<[T], T> =>
  // @ts-ignore
  mapState(
    (ctx, newState, oldState) =>
      ctx.cause!.parents.length === 0 || predicate(newState, oldState!)
        ? newState
        : oldState!,
    name,
  )

/** Convert action to atom with optional fallback state (with all properties saving) */
export const toAtom =
  <T extends Action, State = undefined | ActionResult<T>>(
    fallback?: State,
    name?: string,
  ): Fn<
    [T],
    // need to prevent empty `{}` in type
    AtomProperties<T> extends never
      ? Atom<State | ActionResult<T>>
      : Atom<State | ActionResult<T>> & {
          [K in AtomProperties<T>]: T[K]
        }
  > =>
  (anAction): any => {
    throwReatomError(!anAction.__reatom.isAction, 'action expected')

    return Object.assign(
      {},
      anAction,
      atom(
        (ctx, state = fallback) =>
          ctx.spy(anAction).reduce((acc, v) => v, state),
        name,
      ),
    )
  }

export const toPromise =
  <T extends Atom, Res = AtomReturn<T>>(
    ctx: Ctx,
    mapper: Fn<[Ctx, Awaited<AtomReturn<T>>], Res> = (ctx, v: any) => v,
  ): Fn<[T], Promise<Awaited<Res>>> =>
  (anAtom) =>
    new Promise<T>((res, fn: Fn) => {
      // reuse variable to bytes safety
      fn = onUpdate(
        anAtom,
        (_ctx, state) =>
          ctx.meta === _ctx.meta && ctx.schedule(() => (fn(), res(state))),
      )
    }).then<any>((s: any) => mapper(ctx, s))

// TODO
// export const view = <T, K extends keyof T>
