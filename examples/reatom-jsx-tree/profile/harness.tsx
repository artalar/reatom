/* @jsx h */
/* @jsxFrag hf */
/**
 * Headless profiling harness for the reatom-jsx-tree example.
 *
 * Usage (from repo root): SCENARIO=<name> N=<nodes> ITER=<iterations>\
 * Node --import=tsx --cpu-prof --expose-gc\
 * Examples/reatom-jsx-tree/profile/harness.tsx
 *
 * Scenarios: build | toggle | add-remove | rebuild | leak-check
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator'

GlobalRegistrator.register()

// happy-dom's NodeIterator lacks `referenceNode`, which @reatom/jsx relies on
// for subscription bookkeeping. Wrap createNodeIterator to track it manually.
const originalCreateNodeIterator = document.createNodeIterator.bind(document)
document.createNodeIterator = ((root: Node, whatToShow?: number) => {
  const iterator = originalCreateNodeIterator(root, whatToShow)
  let reference: Node = root
  return {
    nextNode() {
      const node = iterator.nextNode()
      if (node) reference = node
      return node
    },
    previousNode() {
      const node = iterator.previousNode()
      if (node) reference = node
      return node
    },
    get referenceNode() {
      return reference
    },
  }
}) as typeof document.createNodeIterator

const { atom, notify, isConnected } = await import('@reatom/core')
const { h, hf, mount } = await import('@reatom/jsx')
const { createTree } = await import('../src/model')

type Tree = import('../src/model').Tree

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

const SCENARIO = process.env.SCENARIO ?? 'toggle'
const N = Number(process.env.N ?? 256)
const ITER = Number(process.env.ITER ?? 100)

const flush = async () => {
  notify()
  await new Promise((resolve) => setTimeout(resolve))
}

const gc = globalThis.gc as undefined | (() => void)
const heapMb = () => {
  gc?.()
  return (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
}

const container = document.createElement('main')
document.body.appendChild(container)

const root = atom(createTree(N), 'root')
mount(container, <div>{() => <TreeNode tree={root()} />}</div>)
await flush()

console.log(
  `scenario=${SCENARIO} N=${N} ITER=${ITER} mounted, heap=${heapMb()}MB`,
)

const time = async (label: string, fn: () => Promise<void> | void) => {
  const start = performance.now()
  await fn()
  console.log(`${label}: ${(performance.now() - start).toFixed(1)}ms`)
}

switch (SCENARIO) {
  case 'build': {
    await time(`build+mount x${ITER}`, async () => {
      for (let i = 0; i < ITER; i++) {
        root.set(createTree(N))
        await flush()
      }
    })
    break
  }

  case 'toggle': {
    const tree = root()
    const checkbox = container.querySelector(
      'input[type=checkbox]',
    ) as HTMLInputElement
    tree.toggle(true)
    await flush()
    const checkedAfterTrue = checkbox.checked
    tree.toggle(false)
    await flush()
    console.log(
      `dom fidelity: checked true=${checkedAfterTrue} false=${checkbox.checked}`,
    )
    await time(`toggle root x${ITER}`, async () => {
      for (let i = 0; i < ITER; i++) {
        tree.toggle(i % 2 === 0)
        await flush()
      }
    })
    break
  }

  case 'add-remove': {
    const tree = root()
    await time(`add+remove leaf x${ITER}`, async () => {
      for (let i = 0; i < ITER; i++) {
        const node = tree.add(`bench${i}`)
        await flush()
        node.del()
        await flush()
      }
    })
    break
  }

  case 'rebuild': {
    await time(`rebuild x${ITER}`, async () => {
      for (let i = 0; i < ITER; i++) {
        root.set(createTree(N))
        await flush()
        if (i % 10 === 0) console.log(`  iter ${i} heap=${heapMb()}MB`)
      }
    })
    break
  }

  case 'leak-check': {
    const collectAtoms = (tree: Tree): Array<[string, () => boolean]> => {
      const result: Array<[string, () => boolean]> = [
        [`${tree.id}.checked`, () => isConnected(tree.checked)],
        [`${tree.id}.indeterminate`, () => isConnected(tree.indeterminate)],
        [`${tree.id}.children`, () => isConnected(tree.children)],
      ]
      for (const child of tree.children.array()) {
        result.push(...collectAtoms(child))
      }
      return result
    }

    const before = heapMb()
    const generations: Array<Array<[string, () => boolean]>> = []
    for (let i = 0; i < ITER; i++) {
      generations.push(collectAtoms(root()))
      root.set(createTree(N))
      await flush()
      await flush()
      const summary = generations
        .map((gen) => gen.filter(([, connected]) => connected()).length)
        .join(',')
      console.log(`iter ${i}: connected per old generation: [${summary}]`)
    }
    console.log(`heap before=${before}MB after=${heapMb()}MB`)
    break
  }

  default:
    throw new Error(`unknown scenario ${SCENARIO}`)
}

console.log(
  `done, heap=${heapMb()}MB, dom nodes=${container.querySelectorAll('*').length}`,
)
process.exit(0)
