/**
 * Regression: rendering a linked list inside a reactive function child (`{() =>
 * <TreeNode tree={root()} />}`, as in examples/reatom-jsx-tree) used to make
 * that computed depend on every (nested) list: `walkLinkedList` performed a
 * tracked `list()` read during element construction. A single `create` on any
 * list then invalidated the wrapper, recreated the whole subtree, and each
 * recreation called `reatomMap` from scratch (fresh derived atom → full-rebuild
 * branch) — the entire tree was remapped for one added leaf. The initial read
 * is untracked (`peek`) now, so only the new leaf is mapped. Scenarios cover
 * the feature bisect that located the trigger.
 */
import {
  action,
  atom,
  clearStack,
  computed,
  context,
  getCalls,
  type LinkedListAtom,
  type LLNode,
  notify,
  peek,
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

type TreeOpts = {
  withChecked?: boolean
  withGetCalls?: boolean
  withIndeterminate?: boolean
  wrapAddInAction?: boolean
}

type Tree = {
  id: string
  children: LinkedListAtom<[name: string], Tree>
  checked?: ReturnType<typeof computed<boolean>>
  indeterminate?: ReturnType<typeof computed<boolean>>
  toggle?: ReturnType<typeof action>
  add: (name: string) => LLNode<Tree>
}

const reatomTree = (
  id: string,
  opts: TreeOpts,
  parentChildren?: LinkedListAtom<[name: string], Tree>,
): Tree => {
  const name = `tree#${id}`

  const children = reatomLinkedList(
    {
      create: (childName: string): Tree =>
        reatomTree(childName, opts, children),
    },
    `${name}.children`,
  )

  let checked: Tree['checked']
  let indeterminate: Tree['indeterminate']
  let toggle: Tree['toggle']

  if (opts.withChecked || opts.withIndeterminate || opts.withGetCalls) {
    const indeterminateChildren = computed(
      () =>
        children
          .array()
          .some((child) =>
            child.indeterminate ? child.indeterminate() : false,
          ),
      `${name}._indeterminateChildren`,
    )

    const checkedCount = computed(
      () =>
        children
          .array()
          .reduce(
            (acc, child) => (child.checked && child.checked() ? acc + 1 : acc),
            0,
          ),
      `${name}._checkedCount`,
    )

    if (opts.withIndeterminate) {
      indeterminate = computed(() => {
        const count = checkedCount()
        const { size } = children()
        return indeterminateChildren() || (count > 0 && count < size)
      }, `${name}.indeterminate`)
    }

    toggle = action((state?: boolean) => {
      state ??= !(indeterminate?.() ?? false)
      children.array().forEach((child) => child.toggle?.(state))
      return state
    }, `${name}.toggle`)

    if (opts.withChecked || opts.withGetCalls) {
      checked = computed(() => {
        const count = checkedCount()
        const { size } = children()
        let state = size === 0 || count === size

        if (opts.withGetCalls) {
          getCalls(toggle!).forEach(({ payload }) => {
            state = payload
          })
        }

        return state
      }, `${name}.checked`)
    }
  }

  const add = opts.wrapAddInAction
    ? action((childName: string) => children.create(childName), `${name}.add`)
    : (childName: string) => children.create(childName)

  void parentChildren

  return {
    id,
    children,
    checked,
    indeterminate,
    toggle,
    add,
  }
}

/** Root + a(a1,a2) + b(b1) = 6 nodes, 5 parent→child edges */
const buildSampleTree = (opts: TreeOpts) => {
  const root = reatomTree('root', opts)
  const a = root.add('a')
  a.add('a1')
  a.add('a2')
  const b = root.add('b')
  b.add('b1')
  return root
}

type Scenario = {
  label: string
  treeOpts?: TreeOpts
  bindChecked?: boolean
  /** App.tsx pattern: `{() => <TreeNode tree={root()} />}` */
  reactiveRootWrapper?: boolean
  /** Prove tracking: only subscribe to root, peek the TreeNode create */
  peekTreeNode?: boolean
}

const runScenario = async (opts: Scenario) => {
  const treeOpts = opts.treeOpts ?? {}
  const mapperCalls: string[] = []
  const root = buildSampleTree(treeOpts)

  const TreeNode = ({ tree }: { tree: Tree }): JSX.Element => (
    <div>
      {opts.bindChecked && tree.checked ? (
        <input
          type="checkbox"
          checked={tree.checked}
          indeterminate={tree.indeterminate}
        />
      ) : null}
      <ul>
        {tree.children.reatomMap((child: Tree) => {
          mapperCalls.push(`${tree.id}->${child.id}`)
          return (
            <li>
              <TreeNode tree={child} />
            </li>
          ) as unknown as any
        }, `${tree.id}.views`)}
      </ul>
    </div>
  )

  let view: Element
  if (opts.reactiveRootWrapper) {
    const rootAtom = atom(root, 'root')
    view = (
      <main>
        {opts.peekTreeNode
          ? () => {
              const tree = rootAtom()
              return peek(() => <TreeNode tree={tree} />)
            }
          : () => <TreeNode tree={rootAtom()} />}
      </main>
    ) as unknown as Element
  } else {
    view = (<TreeNode tree={root} />) as unknown as Element
  }

  mount(createContainer(), view)
  await wrap(sleep())
  await wrap(sleep())
  const mountCalls = mapperCalls.length

  mapperCalls.length = 0
  root.add('c')
  notify()
  await wrap(sleep())
  await wrap(sleep())

  const addCalls = [...mapperCalls]
  console.log(
    `[${opts.label}] mount=${mountCalls} add=${addCalls.length} ${JSON.stringify(addCalls)}`,
  )

  return { addCalls, mountCalls }
}

test('plain list: only new leaf', () =>
  context.start(async () => {
    const { addCalls, mountCalls } = await runScenario({ label: 'plain' })
    expect(mountCalls).toBe(5)
    expect(addCalls).toEqual(['root->c'])
  }))

test('checked+indeterminate computeds (unbound): only new leaf', () =>
  context.start(async () => {
    const { addCalls } = await runScenario({
      label: 'computeds-unbound',
      treeOpts: { withChecked: true, withIndeterminate: true },
    })
    expect(addCalls).toEqual(['root->c'])
  }))

test('checked+indeterminate bound in view: only new leaf', () =>
  context.start(async () => {
    const { addCalls } = await runScenario({
      label: 'computeds-bound',
      treeOpts: { withChecked: true, withIndeterminate: true },
      bindChecked: true,
    })
    expect(addCalls).toEqual(['root->c'])
  }))

test('getCalls in checked + bound: only new leaf', () =>
  context.start(async () => {
    const { addCalls } = await runScenario({
      label: 'getCalls-bound',
      treeOpts: {
        withChecked: true,
        withIndeterminate: true,
        withGetCalls: true,
      },
      bindChecked: true,
    })
    expect(addCalls).toEqual(['root->c'])
  }))

test('action-wrapped add: only new leaf', () =>
  context.start(async () => {
    const { addCalls } = await runScenario({
      label: 'action-add',
      treeOpts: { wrapAddInAction: true },
    })
    expect(addCalls).toEqual(['root->c'])
  }))

test('reactive root wrapper: only new leaf (regression)', () =>
  context.start(async () => {
    const { addCalls, mountCalls } = await runScenario({
      label: 'reactive-wrapper',
      reactiveRootWrapper: true,
    })
    expect(mountCalls).toBe(5)
    expect(addCalls).toEqual(['root->c'])
  }))

test('full app-like model: only new leaf (regression)', () =>
  context.start(async () => {
    const { addCalls } = await runScenario({
      label: 'full-app-like',
      treeOpts: {
        withChecked: true,
        withIndeterminate: true,
        withGetCalls: true,
        wrapAddInAction: true,
      },
      bindChecked: true,
      reactiveRootWrapper: true,
    })
    expect(addCalls).toEqual(['root->c'])
  }))

test('reactive wrapper + peek(TreeNode): only new leaf (tracking proof)', () =>
  context.start(async () => {
    const { addCalls } = await runScenario({
      label: 'reactive-peek',
      reactiveRootWrapper: true,
      peekTreeNode: true,
    })
    expect(addCalls).toEqual(['root->c'])
  }))
