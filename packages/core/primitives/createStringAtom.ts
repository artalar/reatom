import { AtomOptions } from '@reatom/core'
import { createPrimitiveAtom, PrimitiveAtom } from '.'

let count = 0
export function createStringAtom(
  initState?: string,
  options?: AtomOptions,
): PrimitiveAtom<string>
export function createStringAtom<T extends string>(
  initState: T,
  options?: AtomOptions,
): PrimitiveAtom<T>
export function createStringAtom(
  initState = ``,
  options: AtomOptions = `string atom [${++count}]`,
) {
  return createPrimitiveAtom(initState, null, options)
}
