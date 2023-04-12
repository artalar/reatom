import { Atom } from '@reatom/core'
import { __thenReatomed } from '@reatom/effects'
import { onUpdate } from '@reatom/hooks'
import { assign } from '@reatom/utils'
import { type LensAtom } from './'

/** @deprecated use regular `onUpdate` instead */
export const onLensUpdate: typeof onUpdate = onUpdate

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
