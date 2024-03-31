import { atom, action, reatomNumber, NumberAtom } from '@reatom/framework'

const list = atom<Array<NumberAtom>>([], 'list')
const sum = atom(
  (ctx) => ctx.spy(list).reduce((acc, counter) => acc + ctx.spy(counter), 0),
  'sum',
)
const init = atom(0, 'init')
const add = action((ctx) => {
  list(ctx, (state) => {
    const counter = reatomNumber(ctx.get(init), `list#${state.length}`)
    return [...state, counter]
  })
  init(ctx, 0)
}, 'add')
const clear = action((ctx) => list(ctx, []), 'clear')

const Add = () => (
  <>
    <input model:valueAsNumber={init} />
    <button on:click={add}>add</button>
  </>
)

const Counter = ({ counter }: { counter: NumberAtom }) => (
  <button
    css={`
      font-size: calc(1em + var(--size) * 5px);
    `}
    css:size={counter}
    on:click={(ctx) => counter.increment(ctx)}
  >
    {counter}
  </button>
)

export const App = () => (
  <main>
    <Add />
    <br />
    <span>Sum: {sum}</span>
    <br />
    <button on:click={clear}>clear</button>
    <br />
    {atom((ctx) => (
      <ul>
        {ctx.spy(list).map((counter) => (
          <li>
            <Counter counter={counter} />
          </li>
        ))}
      </ul>
    ))}
  </main>
)
