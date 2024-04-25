import { atom } from '@reatom/framework'
import { add, count, list, ListElement, moveDown, moveUp } from './model'
import { Dragable } from './DragTarget'

const Add = () => (
  <form
    on:submit={(ctx, e) => {
      e.preventDefault()
      add(ctx)
    }}
  >
    <input model:valueAsNumber={count} type="number" min={1} autofocus />
    <button>add</button>
  </form>
)

const Item = ({ input }: { input: ListElement }) => {
  const name = input.__reatom.name!
  const hue = atom((ctx) => (ctx.spy(input).length * 30) % 360, `${name}.hue`)

  return (
    <Dragable
      as="li"
      list={list}
      item={input}
      followX={false}
      css={`
        margin: 1em;
        &::marker {
          content: '';
        }
      `}
    >
      <input
        model:value={input}
        css={`
          color: hsl(var(--hue), 50%, 50%);
        `}
        css:hue={hue}
      />
      <button on:click={(ctx) => moveUp(ctx, input)}>👆</button>
      <button on:click={(ctx) => moveDown(ctx, input)}>👇</button>
      <button on:click={(ctx) => list.remove(ctx, input)}>🗑️</button>
    </Dragable>
  )
}

export const App = () => (
  <main>
    <Add />
    <br />
    <button on:click={list.clear}>clear</button>
    <br />
    <ul>
      {list.reatomMap((ctx, input) => (
        <Item input={input} />
      ))}
    </ul>
  </main>
)
