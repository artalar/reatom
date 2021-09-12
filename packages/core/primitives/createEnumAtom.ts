import { Atom, AtomOptions, Rec } from '@reatom/core'

import { createPrimitiveAtom, PrimitiveAtom } from '.'

let count = 0
export function createEnumAtom<
  T extends string,
  Format extends 'camelCase' | 'snake_case' = 'camelCase',
>(
  variants: ReadonlyArray<T>,
  options:
    | Atom['id']
    | (Exclude<AtomOptions, string> & {
        format?: Format
      }) = `enum${++count}`,
): PrimitiveAtom<
  T,
  {
    [K in T as Format extends 'camelCase'
      ? `set${Capitalize<K>}`
      : Format extends 'snake_case'
      ? `set_${K}`
      : never]: () => K
  }
> {
  // @ts-expect-error
  const format: Format = options.format ?? 'camelCase'

  return createPrimitiveAtom(
    variants[0],
    variants.reduce((acc, variant) => {
      const actionCreatorName = variant.replace(
        /^./,
        (firstLetter) =>
          'set' +
          (format === 'camelCase'
            ? firstLetter.toUpperCase()
            : `_${firstLetter}`),
      )
      acc[actionCreatorName] = () => variant
      return acc
    }, {} as Rec),
    options,
  ) as any
}
