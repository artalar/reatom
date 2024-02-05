import {
  withCache,
  withDataAtom,
  withRetry,
  sleep,
  withErrorAtom,
  reatomResource,
} from '@reatom/framework'
import { reatomComponent } from '@reatom/npm-react'
import { searchParamsAtom } from '@reatom/url'
import { withSsr } from '~/ssrPersist'
import { fetchIssuesApi, getErrorMessage, isRateLimitError } from './api'

export const searchAtom = searchParamsAtom.lens('search')

export const fetchIssues = reatomResource(async (ctx) => {
  const query = ctx.spy(searchAtom)
  if (!query) return []
  await sleep(350)
  const items = await fetchIssuesApi(query, ctx.controller)
  return items
}, 'fetchIssues').pipe(
  withDataAtom([]),
  withErrorAtom(getErrorMessage),
  withCache({
    length: 50,
    staleTime: Infinity,
    swr: false,
    withPersist: withSsr,
  }),
  withRetry({
    onReject(ctx, error, retries) {
      if (isRateLimitError(error)) {
        return 100 * Math.min(500, (retries + 1) ** 2)
      }
      return -1
    },
  }),
)

export const Search = reatomComponent(
  ({ ctx }) => (
    <section>
      <input
        value={ctx.spy(searchAtom)}
        onChange={(e) => searchAtom(ctx, e.currentTarget.value)}
        placeholder="Search"
      />
      {ctx.spy(fetchIssues.pendingAtom) || ctx.spy(fetchIssues.retriesAtom)
        ? 'Loading...'
        : null}
      <p>{ctx.spy(fetchIssues.errorAtom)}</p>
      <ul>
        {ctx.spy(fetchIssues.dataAtom).map(({ title, url, id }) => (
          <li key={id}>
            {title} [
            <a href={url} target="_blank" rel="noreferrer">
              link
            </a>
            ]
          </li>
        ))}
      </ul>
    </section>
  ),
  'Search',
)
