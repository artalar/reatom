import { useAction, useAtom } from '@reatom/npm-react'
import { createField, Field, listAtom, newFieldAtom } from './model'

const NewFieldComponent = () => {
  const [input, setInput] = useAtom(newFieldAtom)
  const handleCreate = useAction(
    (ctx, event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      createField(ctx)
    },
  )

  return (
    <form onSubmit={handleCreate}>
      <input
        placeholder="New item name"
        value={input}
        onChange={(e) => setInput(e.currentTarget.value)}
      />
      <button type="submit" disabled={input.length === 0}>
        Create
      </button>
    </form>
  )
}

const FieldComponent = ({ name, value, remove }: Field) => {
  const [input, setInput] = useAtom(value)

  const handleRemove = useAction(remove)

  return (
    <span>
      <input value={input} onChange={(e) => setInput(e.currentTarget.value)} />
      <button onClick={handleRemove}>remove</button>
      {` (${name}) `}
    </span>
  )
}

const ListComponent = () => {
  const [list] = useAtom(listAtom)

  return (
    <ul>
      {list.map((el) => (
        <li key={el.id}>
          <FieldComponent {...el} />
        </li>
      ))}
    </ul>
  )
}

export const App = () => {
  return (
    <main>
      <NewFieldComponent />
      <ListComponent />
    </main>
  )
}
