import {
  _unlinkStats,
  action,
  atom,
  clearStack,
  computed,
  context,
  getCalls,
  type LinkedListAtom,
  type LLNode,
  reatomLinkedList,
  sleep,
  withInit,
  wrap,
} from '@reatom/core'
import { expect, test } from 'vitest'

// eslint-disable-next-line unused-imports/no-unused-imports
import { DEBUG, h, hf, instance, mount } from '.'

clearStack()

DEBUG.extend(withInit(() => false))

const parent = atom(() => {
  const main = instance(HTMLElement, <main />)
  window.document.body.appendChild(main)

  return main
}, 'parent')

type Tree = {
  id: string
  children: LinkedListAtom<[name: string], Tree>
  checked: ReturnType<typeof computed<boolean>>
  indeterminate: ReturnType<typeof computed<boolean>>
  toggle: ReturnType<typeof action<[state?: boolean], boolean>>
  add: ReturnType<typeof action<[name: string], LLNode<Tree>>>
  del: ReturnType<typeof action<[], void>>
}

const reatomTree = (
  id: string,
  parentChildren?: LinkedListAtom<[name: string], Tree>,
): Tree => {
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

const TreeNode = ({ tree }: { tree: Tree }) => (
  <div>
    <input
      type="checkbox"
      checked={tree.checked}
      indeterminate={tree.indeterminate}
      on:change={(e) => tree.toggle(e.currentTarget.checked)}
    />
    <button on:click={tree.del} type="button">
      -
    </button>
    <TreeList tree={tree} />
  </div>
)

test('removing a tree node unlinks via pop despite trailing view listeners', () =>
  context.start(async () => {
    const root = reatomTree('root')
    const left = root.add('L')
    left.add('LL')
    root.add('R')

    mount(
      parent(),
      <div>
        <TreeNode tree={root} />
      </div>,
    )
    await wrap(sleep())

    _unlinkStats.pop = 0
    _unlinkStats.shift = 0

    left.del()
    await wrap(sleep())

    expect(_unlinkStats.shift).toBe(0)
    expect(_unlinkStats.pop).toBeGreaterThan(0)
  }))
