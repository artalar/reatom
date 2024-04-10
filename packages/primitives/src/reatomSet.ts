import { Action, action, atom, AtomMut, Ctx } from '@reatom/core'
import { withAssign } from './withAssign'

export interface SetAtom<T> extends AtomMut<Set<T>> {
  set: Action<[el: T], Set<T>>
  delete: Action<[el: T], Set<T>>
  clear: Action<[], Set<T>>
  reset: Action<[], Set<T>>
  has: (ctx: Ctx, el: T) => boolean
}

export const reatomSet = <T>(
  initState = new Set<T>(),
  name?: string,
): SetAtom<T> =>
  atom(initState, name).pipe(
    withAssign((theAtom, name) => ({
      set: action((ctx, el) => {
        return theAtom(ctx, (prev) => {
          if (prev.has(el)) return prev
          const next = new Set(prev)
          next.add(el)
          return next
        })
      }, `${name}.set`),
      delete: action((ctx, el) => {
        return theAtom(ctx, (prev) => {
          if (!prev.has(el)) return prev
          const next = new Set(prev)
          next.delete(el)
          return next
        })
      }, `${name}.delete`),
      clear: action((ctx) => {
        return theAtom(ctx, (prev) => {
          if (prev.size === 0) return prev
          return new Set<T>()
        })
      }, `${name}.clear`),
      reset: action((ctx) => theAtom(ctx, initState), `${name}.reset`),
      has: (ctx: Ctx, el: T) => ctx.get(theAtom).has(el),
    })),
  )
