import type { Atom } from '@reatom/core'
import { createAtom, withMiddleware } from '@reatom/core'

/**
 * Wraps a caller-owned atom in a model-owned pass-through atom.
 *
 * @remarks
 *   A widget model can not `extend` an adopted atom directly: `extend` mutates
 *   its target in place and throws on already existing keys, so adopting a
 *   `reatomForm` field would both pollute the field and collide on its members.
 *   Reading and writing through a proxy keeps the adopted atom the single
 *   source of truth — no mirroring, no second state that can diverge, and the
 *   same atom can back several models.
 *
 *   Shared by the `checkbox`, `radio`, `combobox`, and `select` models, each of
 *   which lets the caller pass a `valueAtom` to own the widget's value.
 */
export const adoptAtom = <T>(source: Atom<T>, name: string): Atom<T> =>
  // `createAtom` instead of `computed` to keep the `.set` method, like
  // `reatomLens` does.
  createAtom<T>({ computed: () => source() }, name).extend(
    withMiddleware(() => (next, ...params: [] | [T | ((state: T) => T)]): T => {
      if (params.length !== 0) {
        const update = params[0]
        source.set(
          typeof update === 'function'
            ? (update as (state: T) => T)(source())
            : update,
        )
      }
      return next()
    }),
  )
