import { action, Action, atom, AtomMut } from '@reatom/core'

export type EnumFormat = 'camelCase' | 'snake_case'

export type EnumAtom<
  T extends string,
  Format extends EnumFormat = 'camelCase',
> = AtomMut<T> & {
  [Variant in T as Format extends 'camelCase'
    ? `set${Capitalize<Variant>}`
    : Format extends 'snake_case'
    ? `set_${Variant}`
    : never]: Action<[], Variant>
} & {
  reset: Action<[], T>
  enum: { [K in T]: K }
}

export type EnumAtomOptions<
  T extends string,
  Format extends EnumFormat = 'camelCase',
> = {
  name?: string
  format?: Format
  initState?: T
}

export const reatomEnum = <
  const T extends string,
  Format extends 'camelCase' | 'snake_case' = 'camelCase',
>(
  variants: ReadonlyArray<T>,
  options: string | EnumAtomOptions<T, Format> = {},
) => {
  const {
    name,
    format = 'camelCase' as Format,
    initState = variants[0],
  }: EnumAtomOptions<T, Format> = typeof options === 'string'
    ? { name: options }
    : options

  const theAtom = atom(initState, name) as EnumAtom<T, Format>
  const cases = (theAtom.enum = {} as { [K in T]: K })

  theAtom.reset = action((ctx) => theAtom(ctx, initState!), `${name}.reset`)

  for (const variant of variants) {
    cases[variant] = variant
    const setterName = variant.replace(
      /^./,
      (firstLetter) =>
        'set' +
        (format === 'camelCase'
          ? firstLetter.toUpperCase()
          : `_${firstLetter}`),
    )

    ;(theAtom as any)[setterName] = action(
      (ctx) => theAtom(ctx, variant)!,
      `${name}.${setterName}`,
    )
  }

  return theAtom as EnumAtom<T, Format>
}
