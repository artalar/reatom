import {
  reatomAsync,
  withAbort,
  withCache,
  withDataAtom,
  withRetry,
  sleep,
  noop,
  withErrorAtom,
} from '@reatom/framework'
import { useAtom } from '@reatom/npm-react'
import { searchParamsAtom } from '@reatom/url'
import { withSsr } from '~/ssrPersist'

async function fetchIssuesApi(
  query: string,
  { signal }: { signal: AbortSignal },
) {
  const response = await fetch(
    `https://api.github.com/search/issues?q=${query}&page=${1}&per_page=10`,
    { signal },
  )

  if (!response.ok) throw new Error(await response.text())

  const data: { items: Array<Record<string, string>> } = await response.json()

  return data.items.map(({ title, html_url, id }) => ({
    title,
    url: html_url,
    id,
  }))
}

const isRateLimitError = (thing: unknown) =>
  thing instanceof Error && thing.message.includes('rate limit')
const getErrorMessage = (thing: unknown) =>
  isRateLimitError(thing)
    ? undefined
    : thing instanceof Error
    ? thing.message
    : String(thing)

export const searchAtom = searchParamsAtom.lens('search')

export const fetchIssues = reatomAsync(async (ctx, query: string) => {
  await sleep(350)
  const items = await fetchIssuesApi(query, ctx.controller)
  return items
}, 'fetchIssues').pipe(
  withAbort(),
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
searchAtom.onChange((ctx, search) => {
  fetchIssues(ctx, search).catch(noop)
})

export const Search = () => {
  const [search, setSearch] = useAtom(searchAtom)
  const [issues] = useAtom(fetchIssues.dataAtom)
  const [error] = useAtom(fetchIssues.errorAtom)
  // you could create computed atoms directly in `useAtom`
  const [isLoading] = useAtom(
    (ctx) =>
      ctx.spy(fetchIssues.pendingAtom) + ctx.spy(fetchIssues.retriesAtom) > 0,
  )

  return (
    <section>
      <input
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        placeholder="Search"
      />
      {isLoading && 'Loading...'}
      <p>{error}</p>
      {issues.length === 0 ? (
        <span>No issues</span>
      ) : (
        <ul>
          {issues.map(({ title, url, id }) => (
            <li key={id}>
              {title} [
              <a href={url} target="_blank" rel="noreferrer">
                link
              </a>
              ]
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
