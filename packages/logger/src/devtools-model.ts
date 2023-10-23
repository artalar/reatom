import { atom, AtomCache, action } from '@reatom/core'

export const logs = atom([] as AtomCache[], 'logs')

export const logsTrimmed = atom(false, 'logsTrimmed')

export const logsHistorySize = atom(30, 'logsHistorySize')

export const logsAdd = action((ctx, next: AtomCache[]) => {
  const historySize = ctx.get(logsHistorySize)

  const joined = ctx.get(logs).concat(next)
  const trimmed = joined.slice(Math.max(0, joined.length - historySize))

  logs(ctx, trimmed)
  logsTrimmed(ctx, trimmed.length > historySize)
}, 'logsAdd')
