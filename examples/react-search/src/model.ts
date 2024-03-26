// reactive model, unaware of the view

import {
  atom,
  reatomResource,
  sleep,
  withCache,
  withDataAtom,
  withErrorAtom,
  withRetry,
} from '@reatom/framework'
import { searchIssues } from './api'

export const searchAtom = atom('', 'searchAtom')

export const issues = reatomResource(async (ctx) => {
  const query = ctx.spy(searchAtom)
  if (!query) return []
  await ctx.schedule(() => sleep(350))
  const { items } = await searchIssues({
    query,
    controller: ctx.controller,
  })
  return items
}, 'issues').pipe(
  withDataAtom([]),
  withErrorAtom(),
  withCache({ length: 50, swr: false }),
  withRetry({
    onReject(ctx, error: any, retries) {
      // return delay in ms or -1 to prevent retries
      return error?.message.includes('rate limit')
        ? 100 * Math.min(500, retries ** 2)
        : -1
    },
  }),
)
