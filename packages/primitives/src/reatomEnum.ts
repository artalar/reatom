import { atom, AtomMut, Rec } from '@reatom/core'
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

export type EnumAtomOptions<
  T extends string,
  Format extends 'camelCase' | 'snake_case' = 'camelCase',
> = {
  name?: string
  format?: Format
  initState?: T extends any ? T : never
}

export const reatomEnum = <
  T extends string,
  Format extends 'camelCase' | 'snake_case' = 'camelCase',
>(
  variants: ReadonlyArray<T>,
  options: string | EnumAtomOptions<T, Format> = {},
): EnumAtom<T, Format> => {
  const {
    name,
    format = 'camelCase' as Format,
    initState = variants[0],
  }: EnumAtomOptions<T, Format> = typeof options === 'string'
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
  return Object.assign(atom(initState, name).pipe(withReducers(reducers)), {
    enum: cases,
  })
}
