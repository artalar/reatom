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
