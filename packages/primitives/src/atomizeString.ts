import { atom, AtomMut, AtomOptions } from '@reatom/core'
import { withReducers, WithReducers, withReset } from './withReducers'

export type StringAtom<State extends string = string> = WithReducers<
  AtomMut<State>,
  { reset: () => State }
>

export function atomizeString(
  initState?: string,
  options?: AtomOptions,
): StringAtom
export function atomizeString<T extends string>(
  initState: T,
  options?: AtomOptions,
): StringAtom<T>
export function atomizeString(
  initState = ``,
  options: string | AtomOptions = {},
): StringAtom {
  const { name, isInspectable = !!name }: AtomOptions =
    typeof options === 'string' ? { name: options } : options

  return atom(initState, { name: name ?? `string`, isInspectable }).pipe(
    withReset(),
  )
}
