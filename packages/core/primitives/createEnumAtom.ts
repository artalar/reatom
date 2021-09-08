import { Atom, AtomOptions, Rec } from '@reatom/core'

import { createPrimitiveAtom, PrimitiveAtom } from '.'

let count = 0
export function createEnumAtom<
  T extends ReadonlyArray<string>,
  Format extends 'camelCase' | 'snake_case' = 'camelCase',
>(
  variants: T,
  options:
    | Atom['id']
    | (Exclude<AtomOptions, string> & {
        format?: Format
      }) = `enum atom [${++count}] (${variants.join(', ')})`,
): PrimitiveAtom<
  T[number],
  {
    [K in T[number] as Format extends 'camelCase'
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
