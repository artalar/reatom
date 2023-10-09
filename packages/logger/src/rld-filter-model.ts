import { atom, AtomCache, Ctx, action, AtomMut } from '@reatom/core'
import { parseAtoms } from '@reatom/lens'
import { WithPersistOptions } from '@reatom/persist'
import {
  withSessionStorage,
  withLocalStorage,
} from '@reatom/persist-web-storage'
import { reatomArray, ArrayAtom } from '@reatom/primitives'

export type FilterColor = (typeof FilterColors)[number]
export const FilterColors = [
  'red',
  'green',
  'blue',
  'yellow',
  'gray',
  'black',
] as const

export type FilterAction = (typeof FilterActions)[number]
export const FilterActions = ['hide', ...FilterColors] as const

export type Filter = {
  code: AtomMut<string>
  action: AtomMut<FilterAction>
}

const filterMake = (code: string, action: FilterAction) => ({
  code: atom(code),
  action: atom(action),
})

// FIXME https://t.me/reatom_ru/49316
const filterPersistOptions: Partial<WithPersistOptions<Filter[]>> = {
  toSnapshot: parseAtoms,
  fromSnapshot: (ctx, snapshot = []) =>
    (snapshot as any[]).map((filter) => filterMake(filter.code, filter.action)),
}

export const filtersSession = reatomArray(
  [] as Filter[],
  'filtersSession',
).pipe(
  withSessionStorage({
    key: 'rld/filtersSession',
    ...filterPersistOptions,
  }),
)

export const filtersLocal = reatomArray([] as Filter[], 'rldFiltersLocal').pipe(
  withLocalStorage({
    key: 'rld/filterLocal',
    ...filterPersistOptions,
  }),
)

// TODO preserve order
export const filters = atom(
  (ctx) => [...ctx.spy(filtersSession), ...ctx.spy(filtersLocal)],
  'filters',
)

export const filterFunctions = atom((ctx) => {
  return ctx.spy(filters).map((filter) => {
    // TODO execute in a worker
    return new Function(
      'log',
      `var proto = log.proto; var name = proto.name; return ${ctx.spy(
        filter.code,
      )}`,
    ) as (node: AtomCache) => unknown
  })
}, 'filterFunctions')

const filterRun = action((ctx, node: AtomCache) => {
  return ctx.get(filterFunctions).map((fn, i) => {
    try {
      if (fn(node)) return ctx.get(ctx.get(filters).at(i)!.action)
    } catch (error) {
      console.error(error)
      // TODO report error in UI
    }
  })
})

export const filterHide = action((ctx, node: AtomCache) =>
  filterRun(ctx, node).some((action) => action === 'hide'),
)

export const filterColor = action(
  (ctx, node: AtomCache) =>
    filterRun(ctx, node).find((action) => action !== 'hide') as
      | FilterColor
      | undefined,
)

export function filterList(ctx: Ctx, filter: Filter) {
  let list: ArrayAtom<Filter>

  if (ctx.get(filtersSession).includes(filter)) list = filtersSession
  else if (ctx.get(filtersLocal).includes(filter)) list = filtersLocal
  else throw new Error('Unknown filter')

  return list
}

export const filterSplice = action(
  (ctx, filter: Filter, ...replaceWith: Filter[]) => {
    const list = filterList(ctx, filter)
    const index = ctx.get(list).indexOf(filter)
    list(ctx, list.toSpliced(ctx, index, 1, ...replaceWith))
  },
  'filterSplice',
)

export const filterPersistSet = action(
  (ctx, filter: Filter, persist: boolean) => {
    const nextList = persist ? filtersLocal : filtersSession
    filterSplice(ctx, filter)
    nextList(ctx, (prev) => [...prev, filter])
  },
  'filterPersistSet',
)

export const draftCode = atom('', 'draftCode')
export const draftAction = atom('hide' as FilterAction, 'filterDraftAction')
export const draftPersist = atom(false, 'filterDraftPersist')
export const draftCreate = action((ctx) => {
  const filter: Filter = {
    code: atom(ctx.get(draftCode)),
    action: atom(ctx.get(draftAction)),
  }

  const list = ctx.get(draftPersist) ? filtersLocal : filtersSession
  list(ctx, (prev) => [...prev, filter])

  draftCode(ctx, '')
  draftAction(ctx, 'hide')
  draftPersist(ctx, false)
}, 'filterDraftCreate')
