import React from 'react'
import { useAction, useAtom, useCtx, useUpdate } from '@reatom/npm-react'
import { type Ctx, random } from '@reatom/framework'
import { reatomTree, type Tree } from './model'
import './app.css'

let TreeComponent = ({ tree }: { tree: Tree }) => {
  const [name, setName] = useAtom('')
  const [checked] = useAtom(tree.checkedAtom)
  const toggle = useAction(tree.toggle)
  const del = useAction(tree.del)
  const add = useAction((ctx, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    tree.add(ctx, `child_${name}_`)
    setName('')
  })

  // https://github.com/facebook/react/issues/1798#issuecomment-333414857
  const checkboxRef = React.useRef<HTMLInputElement>(null)
  useUpdate(
    (ctx, indeterminate) => {
      if (checkboxRef.current === null) return
      checkboxRef.current.indeterminate = indeterminate
    },
    // `useUpdate` magic is that
    // the indeterminateAtom update will not trigger the component render
    [tree.indeterminateAtom],
  )

  return (
    <div>
      <input
        type="checkbox"
        checked={checked}
        ref={checkboxRef}
        onChange={(e) => toggle(e.currentTarget.checked)}
      />
      <form onSubmit={add} style={{ display: 'inline' }}>
        <input
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Name"
        />
        <button disabled={name.length < 1} type="submit">
          +
        </button>
      </form>
      {tree.del !== undefined && <button onClick={del}>-</button>} ({tree.id})
      <TreeList tree={tree} />
    </div>
  )
}
TreeComponent = React.memo(TreeComponent) as typeof TreeComponent

let TreeList = ({ tree }: { tree: Tree }) => {
  const [children] = useAtom(tree.childrenAtom)
  return (
    <ul>
      {children.map((child) => (
        <li key={child.id}>
          <TreeComponent tree={child} />
        </li>
      ))}
    </ul>
  )
}
TreeList = React.memo(TreeList) as typeof TreeComponent

export const App = () => {
  const ctx = useCtx()
  const tree = React.useMemo(() => ctx.get(() => createRandomTree(ctx)), [ctx])
  return <TreeComponent tree={tree} />
}

function createRandomTree(
  ctx: Ctx,
  parent = reatomTree('root', undefined),
  depth = random(2, 4),
): Tree {
  if (depth-- > 0) {
    const size = random(1, 3)
    let i = 0
    while (i++ < size) {
      createRandomTree(ctx, parent.add(ctx, `child_${depth}_${size}_`), depth)
    }
  }
  return parent
}
