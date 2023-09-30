import { Atom, AtomMaybe, __count, atom, isAtom } from '@reatom/core'

type Branch<T> = (() => T) | AtomMaybe<T>

export function match<T>(
  target: unknown,
  truthy: Branch<T>,
  falsy: Branch<T>,
): Atom<T>
export function match<T>(
  target: unknown,
  truthy: Branch<T>,
): Atom<T | undefined>
export function match<T>(
  target: unknown,
  truthy: Branch<T>,
  falsy?: Branch<T>,
): Atom<T | undefined> {
  return atom((ctx) => {
    const t = isAtom(target) ? ctx.spy(target) : target
    let branch = t ? truthy : falsy
    if (isAtom(branch)) branch = ctx.spy(branch)
    else if (typeof branch === 'function') branch = (branch as () => T)()
    return branch
  }, __count('match'))
}
