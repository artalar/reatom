import {
  Action,
  atom,
  Atom,
  AtomCache,
  AtomMut,
  AtomState,
  Ctx,
  CtxSpy,
  Fn,
} from '@reatom/core'

// Map state and remove callable signature
type AtomAssign<T extends Atom, State = AtomState<T>> = keyof Omit<
  T,
  '__reatom' | 'pipe'
> extends never
  ? Atom<State>
  : Atom<State> & {
      [K in keyof Omit<T, '__reatom' | 'pipe'>]: T[K]
    }

// Map state
type AtomMutAssign<
  T extends AtomMut,
  State = AtomState<T>,
  Update = Parameters<T>[1],
> = keyof Omit<T, '__reatom' | 'pipe'> extends never
  ? AtomMut<State, Update>
  : AtomMut<State, Update> & {
      [K in keyof Omit<T, '__reatom' | 'pipe'>]: T[K]
    }

const getAtomBlank = <T extends Atom>(anAtom: T) =>
  typeof anAtom === 'function'
    ? // @ts-ignore
      anAtom.bind(null)
    : {}

/** Remove callable signature to prevent the atom update from outside  */
export const readonly = <T extends Atom>(anAtom: T): AtomAssign<T> =>
  Object.assign<any, any>({}, anAtom)

/** Remove all extra properties from the atom to pick the essence */
export const plain = <T extends Atom>(
  anAtom: T,
): T extends AtomMut<infer State, infer Update>
  ? AtomMut<State, Update>
  : Atom<AtomState<T>> =>
  Object.assign(getAtomBlank(anAtom), {
    __reatom: anAtom.__reatom,
    pipe: anAtom.pipe,
  })

/** Transform atom state (with all properties saving) */
export const map =
  <T extends Atom, Res>(
    mapper: Fn<[AtomState<T>, undefined | AtomState<T>, Ctx], Res>,
    name?: string,
  ): Fn<[T], T extends AtomMut ? AtomMutAssign<T, Res> : AtomAssign<T, Res>> =>
  (anAtom: Atom) =>
    Object.assign(
      getAtomBlank(anAtom),
      anAtom,
      atom(
        (ctx): any =>
          mapper(ctx.spy(anAtom), ctx.cause!.parents.at(0)?.state, ctx),
        name,
      ),
    )

/** Get atom (with all properties saving) with resolved action value in state */
export const mapAwaited =
  <T extends Action<any[], Promise<any>>, Res>(
    fallback: Res,
    mapper: Fn<[Awaited<AtomState<T>[number]>], Res>,
    name?: string,
  ): Fn<[T], AtomMutAssign<T, Res>> =>
  (anAction) => {
    const versionAtom = atom(0)
    return Object.assign(
      getAtomBlank(anAction),
      anAction,
      atom((ctx, state: any = fallback) => {
        let value: any = ctx.spy(anAction as Atom).at(-1)

        if (value instanceof Promise) {
          const version = versionAtom(ctx, (s) => ++s)
          value.then(
            (v) =>
              version === ctx.get(versionAtom) &&
              ctx.get((read, actualize) =>
                actualize!(
                  ctx,
                  ctx.cause!.meta,
                  (patchCtx: CtxSpy, patch: AtomCache) => {
                    patch.cause = ctx.cause!.cause
                    patch.state = mapper(v)
                  },
                ),
              ),
          )
        }

        return state
      }, name),
    )
  }

/** Transform atom update payload (with all properties saving) */
export const mapInput =
  <T extends AtomMut, Update>(
    mapper: Fn<[Update], Parameters<T>[1]>,
  ): Fn<[T], AtomMutAssign<T, AtomState<T>, Update>> =>
  (anAtom) =>
    Object.assign(
      (ctx: Ctx, input: Update) => anAtom(ctx, mapper(input)),
      anAtom,
    )

/** Filter atom updates (with all properties saving) */
export const filter = <T extends Atom>(
  predicate: Fn<[AtomState<T>, AtomState<T>], boolean>,
  name?: string,
): Fn<[T], T> =>
  // @ts-ignore
  map(
    (newState, oldState, ctx) =>
      ctx.cause!.parents.length === 0
        ? newState
        : predicate(newState, oldState!)
        ? newState
        : oldState!,
    name,
  )

/** The action will react to new atom updates */
export const toAction =
  <T>(name?: string): Fn<[Atom<T>], Action<[never], T>> =>
  (anAtom) => {
    const theAction = atom((ctx, state?: any[]) => {
      const value = ctx.spy(anAtom)

      // skip first computation by connection
      if (state === undefined) return []

      return state.concat([value])
    }, name)
    theAction.__reatom.isAction = true
    return theAction as Action
  }

// TODO
// export const view = <T, K extends keyof T>
