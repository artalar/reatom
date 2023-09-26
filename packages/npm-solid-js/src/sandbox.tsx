import { render } from 'solid-js/web'
import { atom, createCtx } from '@reatom/core'
import { connectLogger } from '@reatom/logger'
import { useAtom, reatomContext } from '.'

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
