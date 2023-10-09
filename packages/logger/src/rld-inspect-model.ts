import { AtomCache, action, atom } from '@reatom/core'
import { caches } from './rld-model'
import {
  FilterAction,
  FilterColor,
  filterColor,
  filterHide,
  filters,
} from './rld-filter-model'
import { parseAtoms } from '@reatom/lens'

export type Log = { cache: AtomCache; color?: FilterColor }
export type LogGroup = Log | { hide: Log[] }

export const logSelected = atom(null as Log | null, 'logSelected')
export const logSelect = action((ctx, log: Log) => {
  if (ctx.get(logSelected) === log) {
    logSelected(ctx, null)
    return
  }
  logSelected(ctx, log)
}, 'logSelect')

export const logGroups = atom((ctx) => {
  const logs = ctx
    .spy(caches)
    .map((cache) => ({ cache, color: filterColor(ctx, cache) }))
  const groups: LogGroup[] = []

  // otherwise we lose reactivity because filters are used in actions
  parseAtoms(ctx, filters)

  for (const log of logs) {
    if (filterHide(ctx, log.cache)) {
      let group = groups.at(-1)
      if (!group || !('hide' in group)) {
        group = { hide: [] }
        groups.push(group)
      }
      // TODO colors for hidden logs
      group.hide.push({ cache: log.cache })
      continue
    }
    groups.push(log)
  }

  return groups
})
