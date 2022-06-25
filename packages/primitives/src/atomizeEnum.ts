import { atom, AtomMut, AtomOptions, Rec } from '@reatom/core'
import { withReducers, WithReducers } from './withReducers'

export type EnumAtom<
  T extends string,
  Format extends 'camelCase' | 'snake_case' = 'camelCase',
> = WithReducers<
  AtomMut<T>,
  {
    [K in T as Format extends 'camelCase'
      ? `set${Capitalize<K>}`
      : Format extends 'snake_case'
      ? `set_${K}`
      : never]: () => K
  } & {
    reset: () => T
  }
> & {
  enum: { [K in T]: K }
}

export function atomizeEnum<
  T extends string,
  Format extends 'camelCase' | 'snake_case' = 'camelCase',
>(
  variants: ReadonlyArray<T>,
  options:
    | string
    | (AtomOptions & {
        format?: Format
        initState?: T extends any ? T : never
      }) = {},
): EnumAtom<T, Format> {
  const {
    name,
    isInspectable = !!name,
    format = 'camelCase' as Format,
    initState = variants[0],
  }: Exclude<typeof options, string> = typeof options === 'string'
    ? { name: options }
    : options
  const cases = {} as Rec
  const reducers = {} as Rec

  for (const variant of variants) {
    cases[variant] = variant

    const reducerName = variant.replace(
      /^./,
      (firstLetter) =>
        'set' +
        (format === 'camelCase'
          ? firstLetter.toUpperCase()
          : `_${firstLetter}`),
    )
    reducers[reducerName] = () => variant
  }

  reducers.reset = () => initState

  // @ts-expect-error
  return Object.assign(
    atom(initState, {
      name: name ?? `enum`,
      isInspectable,
    }).pipe(withReducers(reducers)),
    { enum: cases },
  )
}
