import {
  type Action,
  action,
  type Computed,
  computed,
  getCalls,
  type LinkedListAtom,
  type LLNode,
  random,
  reatomLinkedList,
} from '@reatom/core'

export type Tree = {
  id: string
  children: LinkedListAtom<[name: string], Tree>
  checked: Computed<boolean>
  indeterminate: Computed<boolean>
  toggle: Action<[state?: boolean], boolean>
  add: Action<[name: string], LLNode<Tree>>
  del: Action<[], void>
}

export const reatomTree = (
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

  // Aggregate without reading `indeterminate` — that edge forms a recursive
  // diamond with parent `checkedCount → child.checked` and retains O(n²+) frames.
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

  const del = action(() => {
    parentChildren?.remove(tree as LLNode<Tree>)
  }, `${name}.del`)

  const tree: Tree = {
    id,
    children,
    checked,
    indeterminate,
    toggle,
    add,
    del,
  }

  return tree
}

/**
 * Builds a complete binary-ish tree with exactly `nodeCount` nodes (including
 * root). Top-down via `add` so each child closes over its parent list for
 * `del`.
 */
export const createTree = (nodeCount: number): Tree => {
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
