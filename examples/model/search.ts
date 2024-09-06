import {
  atom,
  reatomResource,
  sleep,
  withCache,
  withDataAtom,
  withErrorAtom,
  withRetry,
  withAssign,
  action,
} from '@reatom/framework'
import { withSearchParamsPersist } from '@reatom/url'

export const searchAtom = atom('', 'searchAtom')

export const pageAtom = atom(1, 'pageAtom').pipe(
  withSearchParamsPersist('page', (page) => Number(page || 1)),
  withAssign((target, name) => ({
    next: action((ctx) => target(ctx, (page) => page + 1), `${name}.next`),
    prev: action((ctx) => target(ctx, (page) => Math.max(1, page - 1)), `${name}.prev`),
  })),
)

export const issuesResource = reatomResource(async (ctx) => {
  const query = ctx.spy(searchAtom)
  const page = ctx.spy(pageAtom)

  if (!query) return []

  // debounce
  await ctx.schedule(() => sleep(350))

  const { items } = await api.searchIssues({ query, page, signal: ctx.controller.signal })
  return items
}, 'issues').pipe(
  withDataAtom([]),
  withErrorAtom(),
  withCache({ length: Infinity, swr: false, staleTime: 3 * 60 * 1000 }),
  withRetry({
    onReject(ctx, error, retries) {
      if (error instanceof Error && error?.message.includes('rate limit')) {
        // exponential backoff
        return 100 * Math.min(500, retries ** 2)
      }
      // do nothing
      return -1
    },
  }),
)

/*
--- API GEN (kinda) ---
*/

export interface Issue {
  repository_url: string
  labels_url: string
  comments_url: string
  events_url: string
  html_url: string
  number: number
  title: string
  user: any
  labels: object[]
  state: string
  locked: string
  assignees: object[]
  milestone: { url: string }
  comments: 2
  author_association: string
  body: string
  created_at: string
  closed_by: object
}

export interface IssuesResponse {
  total_count: number
  items: Array<Issue>
}

export const api = {
  async searchIssues({
    query,
    page = 1,
    perPage = 10,
    signal,
  }: {
    query: string
    page?: number
    perPage?: number
    signal: AbortSignal
  }): Promise<IssuesResponse> {
    const response = await fetch(`https://api.github.com/search/issues?q=${query}&page=${page}&per_page=${perPage}`, {
      signal,
    })

    if (response.status !== 200) {
      const error = new Error(`HTTP Error: ${response.statusText}`)
      const meta = await response.json().catch(() => ({}))
      throw Object.assign(error, meta)
    }

    return await response.json()
  },
}
