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
  Rec,
  throwReatomError,
} from '@reatom/core'
import { isChanged, onUpdate } from '@reatom/hooks'

declare const NEVER: unique symbol
type NEVER = typeof NEVER

// `never` helps to infer correct type
export const SKIP: never = 'REATOM_SKIP_MARK' as any as never

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
  typeof parentAtom === 'function' && derivedAtom !== undefined
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
    mapper: Fn<[Ctx, AtomState<T>, undefined | AtomState<T>, unknown], Res>,
    name?: string,
  ): Fn<[T], AtomMap<T, Res>> =>
  (anAtom: Atom): any => {
    const theAtom = atom((ctx, state?: any) => {
      const depState = ctx.spy(anAtom)
      if (isAction && depState.length === 0) return state ?? []
      return mapper(ctx, depState, ctx.cause!.parents.at(0)?.state, state)
    }, name)

    const isAction = (theAtom.__reatom.isAction = anAtom.__reatom.isAction)

    return Object.assign(getAtomBlank(anAtom, theAtom), anAtom, theAtom)
  }

export const mapPayload =
  <T extends Action, Res>(
    mapper: Fn<[Ctx, ReturnType<T>], Res>,
    name?: string,
    // FIXME: replace `NEVER` by `never, currently it throws a type error
    // (for `mapPayloadAwaited` too)
  ): Fn<[T], AtomMap<T, Res, [NEVER]>> =>
  (anAction): any => {
    throwReatomError(!anAction.__reatom.isAction, 'action expected')

    const theAction = Object.assign(
      () => throwReatomError(1, 'derived action call'),
      anAction,
      anAction.pipe(
        mapState((ctx, payloads, prevPayloads, state) => {
          for (
            var newState = [], i = ctx.cause!.state.length;
            i < payloads.length;
            i++
          ) {
            const newPayload = mapper(ctx, payloads[i])
            if (newPayload !== SKIP) newState.push(newPayload)
          }

          return newState.length > 0 ? newState : state
        }, name),
      ),
    )
    theAction.__reatom.isAction = true

    return theAction
  }

/** Get atom (with all properties saving) with resolved action value in state */
export const mapPayloadAwaited =
  <T extends Action, Res = Awaited<ActionResult<T>>>(
    mapper: Fn<[Ctx, Awaited<ActionResult<T>>], Res> = (ctx, v) => v,
    name?: string,
  ): Fn<[T], AtomMap<T, Awaited<Res>, [NEVER]>> =>
  (anAction): any =>
    anAction.pipe(
      mapPayload((ctx, promise: any) => {
        if (promise instanceof Promise) {
          // @ts-expect-error
          const subscriptions: Array<Fn> = (promise.__reatom_subscriptions ??=
            [])

          if (subscriptions.length === 0) {
            promise.then(
              (v) =>
                ctx.get((read, actualize) =>
                  subscriptions.forEach((cb) => cb(v, actualize)),
                ),
              () => {},
            )
          }

          subscriptions.push((v, actualize) =>
            actualize!(
              ctx,
              ctx.cause!.meta,
              (patchCtx: Ctx, patch: AtomCache) => {
                patch.cause = ctx.cause!.cause
                patch.state = [...patch.state, mapper(ctx, v)]
              },
            ),
          )

          return SKIP
        } else {
          return mapper(ctx, promise)
        }
      }, name),
    )

/** Transform atom update payload (with all properties saving) */
// TODO type inference broken on without explicit Ctx return (currently described by `Parameters<T>`)
export const mapInput =
  <T extends AtomMut | Action, Args extends [Ctx, ...any[]]>(
    mapper: Fn<Args, Parameters<T>[1]>,
  ): Fn<[T], AtomMap<T, AtomState<T>, CtxLessParams<Args>>> =>
  (anAtom): any =>
    Object.assign((...args: Args) => anAtom(args[0], mapper(...args)), anAtom)

/** Filter atom updates (with all properties saving) */
export const filter = <T extends Atom>(
  predicate: T extends Action<any, T>
    ? Fn<[T, T], boolean>
    : Fn<[AtomState<T>, AtomState<T>], boolean>,
  // TODO: how to mark possibility to reuse the name?
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

// TODO: is it best api and naming design?
export const toPromise =
  <T extends Atom, Res = AtomReturn<T>>(
    ctx: Ctx,
    mapper: Fn<[Ctx, Awaited<AtomReturn<T>>], Res> = (ctx, v: any) => v,
  ): Fn<[T], Promise<Awaited<Res>>> =>
  (anAtom) =>
    new Promise<Awaited<Res>>((res, fn: Fn, _skipFirst = true) => {
      // reuse variable to bytes safety
      fn = ctx.subscribe(anAtom, (state) =>
        _skipFirst
          ? (_skipFirst = false)
          : (fn(),
            // @ts-expect-error
            res(mapper(ctx, anAtom.__reatom.isAction ? state[0] : state))),
      )
    })

export const unstable_actionizeAllChanges = <T extends Rec<Atom> | Array<Atom>>(
  shape: T,
  name?: string,
): Action<
  [NEVER],
  {
    [K in keyof T]: AtomState<T[K]>
  }
> => {
  const cacheAtom = atom(
    Object.keys(shape).reduce((acc, k) => ((acc[k] = SKIP), acc), {} as Rec),
  )

  const theAction = atom((ctx, state = []) => {
    for (const key in shape) {
      const anAtom = shape[key] as Atom
      isChanged(ctx, anAtom, (value) => {
        // if (anAtom.__reatom.isAction) {
        //   if (value.length === 0) return
        //   value = value[0]
        // }
        cacheAtom(ctx, (state) => ({ ...state, [key]: value }))
      })
    }

    let cache = ctx.get(cacheAtom)

    if (Object.values(cache).some((v) => v === SKIP)) return state

    for (const key in shape) {
      const anAtom = shape[key] as Atom
      if (anAtom.__reatom.isAction === false) {
        cache = { ...cache, [key]: ctx.get(anAtom) }
      }
    }

    return [Array.isArray(shape) ? Object.values(cache) : cache]
  }, name)
  theAction.__reatom.isAction = true

  return theAction as any
}

// TODO
// export const view = <T, K extends keyof T>
