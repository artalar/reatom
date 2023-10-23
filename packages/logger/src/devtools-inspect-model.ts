import { AtomCache, action, atom } from '@reatom/core'
import { logs } from './devtools-model'
import {
  FilterColor,
  getNodeColor,
  getNodeHidden,
  filters,
} from './devtools-filters-model'
import { parseAtoms } from '@reatom/lens'

export type InspectLog = { cache: AtomCache; color?: FilterColor }
export type InspectLogGroup = InspectLog | { hide: InspectLog[] }

export const logSelected = atom(null as InspectLog | null, 'logSelected')
export const logSelect = action((ctx, log: InspectLog) => {
  if (ctx.get(logSelected) === log) {
    logSelected(ctx, null)
  } else logSelected(ctx, log)
}, 'logSelect')

export const logGroups = atom((ctx) => {
  const inspectLogs = ctx
    .spy(logs)
    .map((cache) => ({ cache, color: getNodeColor(ctx, cache) }))
  const groups: InspectLogGroup[] = []

  // otherwise we lose reactivity because filters are used in actions
  parseAtoms(ctx, filters)

  for (const log of inspectLogs) {
    if (getNodeHidden(ctx, log.cache)) {
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
