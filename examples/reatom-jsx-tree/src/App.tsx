import { atom } from '@reatom/core'

import { createTree, type Tree } from './model'

const TreeList = ({ tree }: { tree: Tree }) => (
  <ul>
    {tree.children.reatomMap(
      (child) => (
        <li>
          <TreeNode tree={child} />
        </li>
      ),
      `${tree.id}.views`,
    )}
  </ul>
)

const TreeNode = ({ tree }: { tree: Tree }) => {
  const name = atom('', `${tree.id}.nameInput`)

  return (
    <div>
      <input
        type="checkbox"
        checked={tree.checked}
        indeterminate={tree.indeterminate}
        on:change={(e) => tree.toggle(e.currentTarget.checked)}
      />
      <form
        style:display="inline"
        on:submit={(e) => {
          e.preventDefault()
          tree.add(`child_${name()}_`)
          name.set('')
        }}
      >
        <input model:value={name} placeholder="Name" />
        <button disabled={() => name().length < 1} type="submit">
          +
        </button>
      </form>
      <button on:click={tree.del} type="button">
        -
      </button>{' '}
      ({tree.id})
      <TreeList tree={tree} />
    </div>
  )
}

export const App = () => {
  const nodeCount = atom(16, 'nodeCount')
  const root = atom(createTree(nodeCount()), 'root')

  return (
    <main
      css={`
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        font-family: monospace;
        gap: 1rem;
      `}
    >
      <form
        css={`
          display: flex;
          align-items: center;
          gap: 0.5rem;
        `}
        on:submit={(e) => {
          e.preventDefault()
          root.set(createTree(nodeCount()))
        }}
      >
        <label>
          Nodes{' '}
          <input
            type="number"
            min={1}
            step={1}
            model:valueAsNumber={nodeCount}
          />
        </label>
        <button type="submit">Build</button>
      </form>
      {() => <TreeNode tree={root()} />}
    </main>
  )
}
