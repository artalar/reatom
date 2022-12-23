import {
  Action,
  Atom,
  AtomMut,
  AtomState,
  createCtx,
  Ctx,
  Fn,
  isAction,
  isAtom,
  throwReatomError,
  Unsubscribe,
} from '@reatom/core'
import { bind } from '@reatom/lens'
import { getContext, setContext } from 'svelte'

type Update<State> = State | Fn<[State, Ctx], State>

const KEY = 'reatomCtx'

export const setupCtx = (ctx = createCtx()) => setContext(KEY, ctx)

export const withSvelte: {
  <
    T extends AtomMut & {
      subscribe?: Fn<[Fn], Unsubscribe>
      set?: Fn<[Update<AtomState<T>>]>
    },
  >(): Fn<
    [T],
    T & {
      subscribe: Fn<[Fn], Unsubscribe>
      set: Fn<[Update<AtomState<T>>]>
    }
  >
  <T extends Atom & { subscribe?: Fn<[Fn], Unsubscribe> }>(): Fn<
    [T],
    T & { subscribe: Fn<[Fn], Unsubscribe> }
  >
} =
  () =>
  (
    anAtom: (Atom | AtomMut) & {
      subscribe?: Fn<[Fn], Unsubscribe>
      set?: Fn
    },
  ) => {
    throwReatomError(!isAtom(anAtom) || isAction(anAtom), 'atom expected')

    const ctx = getContext<Ctx>(KEY)

    anAtom.subscribe = (cb) => ctx.subscribe(anAtom, cb)

    if (typeof anAtom === 'function') anAtom.set = (state) => anAtom(ctx, state)

    return anAtom
  }

export const bindSvelte = <T extends Action>(anAction: T) =>
  bind(getContext<Ctx>(KEY), anAction)
