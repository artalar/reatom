// reactive model, unaware of the view

import {
  atom,
  reatomResource,
  sleep,
  withAbort,
  withCache,
  withDataAtom,
  withErrorAtom,
  withRetry,
} from '@reatom/framework'

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

export const searchAtom = atom('', 'searchAtom')

export const issues = reatomResource(async (ctx) => {
  const query = ctx.spy(searchAtom)
  if (!query) return []
  await sleep(350)
  const { items } = await searchIssues({
    query,
    controller: ctx.controller,
  })
  return items
}, 'issues').pipe(
  withAbort({ strategy: 'last-in-win' }),
  withDataAtom([]),
  withErrorAtom(),
  withCache({ length: 50, swr: false, paramsLength: 1 }),
  withRetry({
    onReject(ctx, error: any, retries) {
      // return delay in ms or -1 to prevent retries
      return error?.message.includes('rate limit')
        ? 100 * Math.min(500, retries ** 2)
        : -1
    },
  }),
)

const searchIssues = async (config: {
  query: string
  controller: AbortController
}) => {
  const response = await fetch(
    `https://api.github.com/search/issues?q=${config.query}&page=1&per_page=10`,
    config.controller,
  )
  if (response.status !== 200) {
    const error = new Error()
    throw Object.assign(error, await response.json())
  }
  return (await response.json()) as { items: Issue[] }
}
