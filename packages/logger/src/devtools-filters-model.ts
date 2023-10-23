import { atom, AtomCache, action, AtomMut } from '@reatom/core'
import { parseAtoms } from '@reatom/lens'
import { withLocalStorage } from '@reatom/persist-web-storage'
import { reatomArray } from '@reatom/primitives'

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
  enabled: AtomMut<boolean>
}

const reatomFilter = (config: {
  code: string
  action: FilterAction
  enabled: boolean
}): Filter => ({
  code: atom(config.code),
  action: atom(config.action),
  enabled: atom(config.enabled),
})

export const filters = reatomArray([] as Filter[], 'filters').pipe(
  withLocalStorage({
    key: '@reatom/logger:filters',
    toSnapshot: parseAtoms,
    fromSnapshot: (ctx, snapshot = []) =>
      (snapshot as any[]).map((config) => reatomFilter(config)),
  }),
)

export const filterSplice = action(
  (ctx, filter: Filter, ...replaceWith: Filter[]) => {
    const index = ctx.get(filters).indexOf(filter)
    filters(ctx, filters.toSpliced(ctx, index, 1, ...replaceWith))
  },
  'filterSplice',
)

export const filtersEnabledGet = atom(
  (ctx) => ctx.spy(filters).some((filter) => ctx.spy(filter.enabled)),
  'filtersEnabledGet',
)

export const filtersEnabledSet = action((ctx, next: boolean) => {
  for (const filter of ctx.get(filters)) filter.enabled(ctx, next)
}, 'filtersEnabledSet')

export const filtersEnabledIndeterminate = atom((ctx) => {
  let some = false
  let every = true
  for (const filter of ctx.spy(filters)) {
    if (ctx.spy(filter.enabled)) {
      some = true
    } else {
      every = false
    }
  }
  return some && !every
}, 'filtersEnabledSet')

const filterFunctions = atom((ctx) => {
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
  const filtersState = ctx.get(filters)
  return ctx.get(filterFunctions).map((fn, i) => {
    try {
      if (!fn(node)) return null
      return ctx.get(filtersState[i]!.action)
    } catch (error) {
      // TODO report error in UI
      console.error(error)
      return null
    }
  })
})

export const getNodeHidden = action((ctx, node: AtomCache) => {
  return filterRun(ctx, node).some((action) => action === 'hide')
})

export const getNodeColor = action((ctx, node: AtomCache) => {
  return filterRun(ctx, node).find((action) => action !== 'hide') as
    | FilterColor
    | undefined
})
export const draftCode = atom('', 'draftCode')
export const draftAction = atom('hide' as FilterAction, 'draftAction')
export const draftCreate = action((ctx) => {
  const filter = reatomFilter({
    code: ctx.get(draftCode),
    action: ctx.get(draftAction),
    enabled: true,
  })

  filters(ctx, (prev) => [...prev, filter])

  draftCode(ctx, '')
  draftAction(ctx, 'hide')
}, 'filterDraftCreate')
