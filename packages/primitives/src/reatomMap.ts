import { action, atom, Ctx } from '@reatom/core'
import { withAssign } from './withAssign'

export type MapAtom<Key, Value> = ReturnType<typeof reatomMap<Key, Value>>

export const reatomMap = <Key, Value>(
  initState = new Map<Key, Value>(),
  name?: string,
) =>
  atom(initState, name).pipe(
    withAssign((theAtom, name) => ({
      get: (ctx: Ctx, key: Key) => ctx.get(theAtom).get(key),
      has: (ctx: Ctx, key: Key) => ctx.get(theAtom).has(key),
      set: action(
        (ctx, key: Key, value: Value) =>
          theAtom(ctx, (prev) => {
            const valuePrev = prev.get(key)
            return Object.is(valuePrev, value) &&
              (value !== undefined || prev.has(key))
              ? prev
              : new Map(prev).set(key, value)
          }),
        `${name}.set`,
      ),
      delete: action(
        (ctx, key: Key) =>
          theAtom(ctx, (prev) => {
            if (!prev.has(key)) return prev
            const next = new Map(prev)
            next.delete(key)
            return next
          }),
        `${name}.delete`,
      ),
      clear: action((ctx) => theAtom(ctx, new Map()), `${name}.clear`),
      reset: action((ctx) => theAtom(ctx, initState), `${name}.reset`),
    })),
  )
