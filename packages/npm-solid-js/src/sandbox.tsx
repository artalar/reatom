import { onCleanup } from 'solid-js'
import { render } from 'solid-js/web'
import { Ctx, action, atom, createCtx } from '@reatom/core'
import { connectLogger } from '@reatom/logger'
import { useAtom, reatomContext, useCtx } from '.'
import { onConnect } from '@reatom/hooks'

const count1Atom = atom(0)
const count2Atom = atom(0)

const Counter = () => {
  const [count1, setCount1] = useAtom(count1Atom)
  const [count2, setCount2] = useAtom(count2Atom)

  return (
    <div>
      Count1 value is{' '}
      <button onClick={() => setCount1((c) => c + 1)}>{count1()}</button>
      Count2 value is{' '}
      <button onClick={() => setCount2((c) => c + 1)}>{count2()}</button>
    </div>
  )
}

const count1Atom = atom(0)
const count2Atom = atom(0)

const Counter = () => {
  const ctx = useCtx()

  return (
    <div>
      Count1 value is{' '}
      <button onClick={() => count1Atom(ctx, (c) => c + 1)}>
        {ctx.signal(count1Atom)()}
      </button>
      Count2 value is{' '}
      <button onClick={() => count2Atom(ctx, (c) => c + 1)}>
        {count2Atom.signal()}
      </button>
    </div>
  )
}

const ctx = createCtx()
connectLogger(ctx)

render(
  () => (
    <reatomContext.Provider value={ctx}>
      <Counter />
    </reatomContext.Provider>
  ),
  document.getElementById('root')!,
)
