import { reatomComponent } from '@reatom/npm-react'
import * as model from './model'

export const App = reatomComponent(({ ctx }) => {
  const isLoading =
    ctx.spy(model.issues.pendingAtom) + ctx.spy(model.issues.retriesAtom) > 0

  return (
    <main>
      <input
        value={ctx.spy(model.searchAtom)}
        onChange={(e) => model.searchAtom(ctx, e.currentTarget.value)}
        placeholder="Search"
      />
      {isLoading && 'Loading...'}
      <ul>
        {ctx.spy(model.issues.dataAtom).map(({ title }, i) => (
          <li key={i}>{title}</li>
        ))}

        {ctx.spy(model.issues.dataAtom).length === 0 && <i>found nothing</i>}
      </ul>
    </main>
  )
})
