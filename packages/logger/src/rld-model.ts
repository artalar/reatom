import { atom, AtomCache, action } from '@reatom/core'

export const caches = atom([] as AtomCache[], 'caches')
export const cachesHistorySize = atom(30, 'cachesHistorySize')
export const cachesAdd = action((ctx, next: AtomCache[]) => {
  const historySize = ctx.get(cachesHistorySize)

  const joined = ctx.get(caches).concat(next)
  const trimmed = joined.slice(Math.max(0, joined.length - historySize))
  caches(ctx, trimmed)
}, 'cachesAdd')
