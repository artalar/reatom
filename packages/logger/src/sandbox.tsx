/** @jsxImportSource react */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { createCtx } from '@reatom/framework'
import { connectLogger } from './index'
import { reatomContext, useAtom } from '@reatom/npm-react'
import { atom, reatomAsync, withAbort, withDataAtom, withRetry, onUpdate, sleep, withCache } from '@reatom/framework' // prettier-ignore

namespace api {
  export const fetchIssues = (query: string, controller: AbortController) =>
    fetch(
      `https://api.github.com/search/issues?q=${query}&page=${1}&per_page=10`,
      controller,
    ).then<{ items: Array<{ title: string }> }>(async (r) => {
      if (r.status !== 200) throw new Error(await r.text())
      return r.json()
    })
}

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
  const [isLoading] = useAtom(
    (ctx) =>
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
      </ul>
    </main>
  )
}

const ctx = createCtx()
// https://www.reatom.dev/packages/logger
// change things and check the devtools console!
const disconnect = connectLogger(ctx, { devtools: true })
if (import.meta.hot) {
  import.meta.hot.accept(disconnect)
}

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(
  <React.StrictMode>
    <reatomContext.Provider value={ctx}>
      <App />
    </reatomContext.Provider>
  </React.StrictMode>,
)
