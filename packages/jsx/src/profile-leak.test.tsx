import {
  type Action,
  action,
  atom,
  type AtomLike,
  clearStack,
  type Computed,
  computed,
  context,
  getCalls,
  isConnected,
  type LinkedListAtom,
  type LLNode,
  random,
  reatomLinkedList,
  sleep,
  withInit,
  wrap,
} from '@reatom/core'
import { expect, test } from 'vitest'

// eslint-disable-next-line unused-imports/no-unused-imports
import { DEBUG, h, hf, instance, type JSX, mount } from '.'

clearStack()

DEBUG.extend(withInit(() => false))

const createContainer = () => {
  const main = instance(HTMLElement, <main />)
  window.document.body.appendChild(main)
  return main
}

type Tree = {
  id: string
  children: LinkedListAtom<[name: string], Tree>
  checked: Computed<boolean>
  indeterminate: Computed<boolean>
  toggle: Action<[state?: boolean], boolean>
  add: Action<[name: string], LLNode<Tree>>
}

const reatomTree = (
  id: string,
  parentChildren?: LinkedListAtom<[name: string], Tree>,
): Tree => {
  id += random(1000, 9999)
  const name = `tree#${id}`

  const children = reatomLinkedList(
    {
      create: (childName: string): Tree => reatomTree(childName, children),
    },
    `${name}.children`,
  )

  const indeterminateChildren = computed(
    () => children.array().some((child) => child.indeterminate()),
    `${name}._indeterminateChildren`,
  )

  const checkedCount = computed(
    () =>
      children
        .array()
        .reduce((acc, child) => (child.checked() ? acc + 1 : acc), 0),
    `${name}._checkedCount`,
  )

  const indeterminate = computed(() => {
    const count = checkedCount()
    const { size } = children()

    return indeterminateChildren() || (count > 0 && count < size)
  }, `${name}.indeterminate`)

  const toggle = action((state?: boolean) => {
    state ??= !indeterminate()
    children.array().forEach((child) => child.toggle(state))
    return state
  }, `${name}.toggle`)

  const checked = computed(() => {
    const count = checkedCount()
    const { size } = children()
    let state = size === 0 || count === size

    getCalls(toggle).forEach(({ payload }) => {
      state = payload
    })

    return state
  }, `${name}.checked`)

  const add = action((childName: string) => {
    return children.create(childName)
  }, `${name}.add`)

  // parentChildren retained for parity with the example model (del wiring).
  void parentChildren

  const tree: Tree = {
    id,
    children,
    checked,
    indeterminate,
    toggle,
    add,
  }

  return tree
}

const createTree = (nodeCount: number): Tree => {
  const size = Math.max(1, Math.floor(nodeCount))
  const root = reatomTree('root')

  const fill = (node: Tree, n: number, label: string) => {
    if (n <= 1) return

    const remaining = n - 1
    const leftSize = Math.ceil(remaining / 2)
    const rightSize = remaining - leftSize

    if (leftSize > 0) {
      const left = node.add(`${label}L`)
      fill(left, leftSize, `${label}L`)
    }
    if (rightSize > 0) {
      const right = node.add(`${label}R`)
      fill(right, rightSize, `${label}R`)
    }
  }

  fill(root, size, 'root')
  return root
}

const collectTreeAtoms = (tree: Tree): AtomLike[] => {
  const atoms: AtomLike[] = [tree.checked, tree.indeterminate, tree.children]
  for (const child of tree.children.array()) {
    atoms.push(...collectTreeAtoms(child))
  }
  return atoms
}

const countConnected = (atoms: AtomLike[]) =>
  atoms.filter((a) => isConnected(a)).length

const TreeNode = ({ tree }: { tree: Tree }): JSX.Element => (
  <div>
    <input
      type="checkbox"
      checked={tree.checked}
      indeterminate={tree.indeterminate}
      on:change={(e) => tree.toggle(e.currentTarget.checked)}
    />
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
  </div>
)

/**
 * Verifies whether replacing a mounted tree root leaks gen0 atom subscriptions
 * in real Chromium (MutationObserver-driven mount/cleanup).
 *
 * A happy-dom harness previously showed gen0 staying connected forever after
 * `rootAtom.set(newTree)` while later generations disconnected. In real
 * Chromium that gen0 leak does **not** reproduce — every generation's model
 * atoms disconnect after being replaced. Treat the happy-dom result as an
 * emulator artifact (imperfect MutationObserver / NodeIterator), not a
 * `@reatom/jsx` mount/cleanup bug.
 */
test('tree root replacement disconnects previous generation atoms', () =>
  context.start(async () => {
    const N = 7
    const gen0 = createTree(N)
    const rootAtom = atom(gen0, 'root')

    mount(
      createContainer(),
      (
        <div>{() => <TreeNode tree={rootAtom()} />}</div>
      ) as unknown as Element,
    )
    await wrap(sleep())

    const gen0Atoms = collectTreeAtoms(gen0)
    expect(countConnected(gen0Atoms)).toBe(gen0Atoms.length)

    const gen1 = createTree(N)
    rootAtom.set(gen1)
    await wrap(sleep())
    await wrap(sleep())
    await wrap(sleep())

    const gen0ConnectedAfterSwap = countConnected(gen0Atoms)
    console.log(
      'gen0 connected after swap:',
      gen0ConnectedAfterSwap,
      '/',
      gen0Atoms.length,
    )

    const gen1Atoms = collectTreeAtoms(gen1)
    expect(countConnected(gen1Atoms)).toBe(gen1Atoms.length)

    const gen2 = createTree(N)
    rootAtom.set(gen2)
    await wrap(sleep())
    await wrap(sleep())
    await wrap(sleep())

    const gen1ConnectedAfterSwap = countConnected(gen1Atoms)
    const gen0ConnectedAfterSecondSwap = countConnected(gen0Atoms)
    console.log(
      'gen1 connected after swap:',
      gen1ConnectedAfterSwap,
      '/',
      gen1Atoms.length,
    )
    console.log(
      'gen0 connected after second swap:',
      gen0ConnectedAfterSecondSwap,
      '/',
      gen0Atoms.length,
    )

    // Chromium: all generations disconnect after replacement (no gen0 leak).
    expect(gen0ConnectedAfterSwap).toBe(0)
    expect(gen0ConnectedAfterSecondSwap).toBe(0)
    expect(gen1ConnectedAfterSwap).toBe(0)
  }))
