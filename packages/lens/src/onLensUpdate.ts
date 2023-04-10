import {
  Action,
  Atom,
  AtomCache,
  AtomMut,
  AtomState,
  Ctx,
  Fn,
  Unsubscribe,
} from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'
import { onUpdate } from '@reatom/hooks'
import { assign, noop } from '@reatom/utils'
import { type LensAtom } from './'

export const onLensUpdate: {
  <Params extends any[], Payload>(
    anAction: Action<Params, Payload>,
    cb?: Fn<
      [
        Ctx,
        Payload,
        AtomCache<AtomState<Action<Params, Payload>>> & { params: Params },
      ]
    >,
  ): Unsubscribe
  <T>(
    anAtom: AtomMut<T> | LensAtom<T>,
    cb?: Fn<[Ctx, T, AtomCache<T>]>,
  ): Unsubscribe
} = (anAtom: Atom, fn = noop) =>
  ((anAtom as LensAtom).deps ?? []).reduce((acc, dep) => {
    const un = onLensUpdate(dep as LensAtom, (ctx) => {
      ctx.get(anAtom)
    })
    return () => {
      un()
      acc()
    }
  }, onUpdate(anAtom, fn) as Unsubscribe)

export const toLens =
  <T extends Atom>(deps: Array<Atom>) =>
  (
    anAtom: T,
  ): T & {
    deps: Array<Atom>
  } =>
    assign(anAtom, {
      deps: ((anAtom as Atom as LensAtom).deps ?? []).concat(deps),
    })
