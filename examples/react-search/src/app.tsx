import {
  atom,
  reatomAsync,
  withAbort,
  withDataAtom,
  withRetry,
  onUpdate,
  sleep,
  withCache,
} from '@reatom/framework'
import { useAtom } from '@reatom/npm-react'
import * as api from './api'

const searchAtom = atom('', 'searchAtom')

const fetchIssues = reatomAsync(async (ctx, query: string) => {
  await sleep(350) // debounce
  const { items } = await api.fetchIssues(query, ctx.controller)
  return items
}, 'fetchIssues').pipe(
  withAbort({ strategy: 'last-in-win' }),
  withDataAtom([]),
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
onUpdate(searchAtom, fetchIssues)

export const App = () => {
  const [search, setSearch] = useAtom(searchAtom)
  const [issues] = useAtom(fetchIssues.dataAtom)
  // you could pass a callback to `useAtom` to create a computed atom
  const [isLoading] = useAtom(
    (ctx) =>
      // even if there are no pending requests, we need to wait for retries
      // let do not show the limit error to make him think that everything is fine for a better UX
      ctx.spy(fetchIssues.pendingAtom) + ctx.spy(fetchIssues.retriesAtom) > 0,
  )

  return (
    <main>
      <input
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        placeholder="Search"
      />
      {isLoading && 'Loading...'}
      <ul>
        {issues.map(({ title }, i) => (
          <li key={i}>{title}</li>
        ))}

        {issues.length === 0 && <i>found nothing</i>}
      </ul>
    </main>
  )
}
