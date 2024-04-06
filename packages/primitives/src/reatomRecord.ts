import { action, atom, Rec } from '@reatom/core'
import { omit } from '@reatom/utils'
import { withAssign } from './withAssign'

export type RecordAtom<T extends Rec> = ReturnType<typeof reatomRecord<T>>

export const reatomRecord = <T extends Rec>(initState: T, name?: string) =>
  atom(initState, name).pipe(
    withAssign((theAtom) => ({
      merge: action(
        (ctx, slice: Partial<T>) =>
          theAtom(ctx, (prev) => {
            for (const key in prev) {
              if (!Object.is(prev[key], slice[key])) {
                return { ...prev, ...slice }
              }
            }
            return prev
          }),
        `${name}.merge`,
      ),

      omit: action(
        (ctx, ...keys: (keyof T)[]) =>
          theAtom(ctx, (prev) => {
            if (keys.some((key) => key in prev)) return omit(prev, keys) as any
            return prev
          }),
        `${name}.omit`,
      ),

      reset: action(
        (ctx, ...keys: (keyof T)[]) =>
          theAtom(ctx, (prev) => {
            if (keys.length === 0) return prev
            const next = {} as T
            let changed = false
            for (const key in prev) {
              if (keys.includes(key)) {
                if (key in initState) {
                  next[key] = initState[key]
                  changed ||= !Object.is(prev[key], initState[key])
                } else {
                  changed ||= key in prev
                }
              } else {
                next[key] = prev[key]
              }
            }
            return changed ? next : prev
          }),
        `${name}.reset`,
      ),
    })),
  )
