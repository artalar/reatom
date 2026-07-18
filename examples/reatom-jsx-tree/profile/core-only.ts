/**
 * Core-only (no DOM) profiling of the tree model. Simulates what the UI
 * subscribes to: checked / indeterminate per node, plus reatomMap views.
 *
 * Usage: SCENARIO=<build|toggle|add-remove> N=<nodes> ITER=<n>\
 * Node --import=tsx --cpu-prof examples/reatom-jsx-tree/profile/core-only.ts
 */
import { notify, type Unsubscribe } from '@reatom/core'

import { createTree, type Tree } from '../src/model'

const SCENARIO = process.env.SCENARIO ?? 'toggle'
const N = Number(process.env.N ?? 256)
const ITER = Number(process.env.ITER ?? 100)

const subscribeAll = (tree: Tree): Unsubscribe[] => {
  const unsubscribes: Unsubscribe[] = [
    tree.checked.subscribe(() => {}),
    tree.indeterminate.subscribe(() => {}),
    tree.children.subscribe(() => {}),
  ]
  for (const child of tree.children.array()) {
    unsubscribes.push(...subscribeAll(child))
  }
  return unsubscribes
}

const time = (label: string, fn: () => void) => {
  const start = performance.now()
  fn()
  console.log(`${label}: ${(performance.now() - start).toFixed(1)}ms`)
}

let tree = createTree(N)
let unsubscribes = subscribeAll(tree)
notify()
console.log(`scenario=${SCENARIO} N=${N} ITER=${ITER}`)

switch (SCENARIO) {
  case 'build': {
    time(`build+subscribe x${ITER}`, () => {
      for (let i = 0; i < ITER; i++) {
        unsubscribes.forEach((un) => un())
        tree = createTree(N)
        unsubscribes = subscribeAll(tree)
        notify()
      }
    })
    break
  }

  case 'toggle': {
    time(`toggle root x${ITER}`, () => {
      for (let i = 0; i < ITER; i++) {
        tree.toggle(i % 2 === 0)
        notify()
      }
    })
    break
  }

  case 'add-remove': {
    time(`add+remove leaf x${ITER}`, () => {
      for (let i = 0; i < ITER; i++) {
        const node = tree.add(`bench${i}`)
        notify()
        node.del()
        notify()
      }
    })
    break
  }

  default:
    throw new Error(`unknown scenario ${SCENARIO}`)
}

process.exit(0)
