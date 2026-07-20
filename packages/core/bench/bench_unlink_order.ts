/**
 * Teardown cost of N subscriptions sharing one pub, torn down in registration
 * (FIFO), reverse (LIFO), and random order — both for computed dependents
 * (graph `unlink`) and for direct effect listeners (`subscribe` unsubscribe).
 *
 * Guards the `_removeSub` hint in `src/core/atom.ts`: LIFO and FIFO batches
 * must stay O(n) for a shared pub; random order is allowed to scan but must not
 * shift the array.
 *
 * Env: `N` — subscription count (default 5000), `RUNS` — samples (default 7).
 */
import { atom, computed, notify } from '../src/core'

const N = Number(process.env.N ?? 5000)
const RUNS = Number(process.env.RUNS ?? 7)

type Order = 'fifo' | 'lifo' | 'random'

const orderIndexes = (order: Order): number[] => {
  const idx = Array.from({ length: N }, (_, i) => i)
  if (order === 'lifo') idx.reverse()
  if (order === 'random') {
    let seed = 42
    for (let i = idx.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      const j = seed % (i + 1)
      ;[idx[i], idx[j]] = [idx[j]!, idx[i]!]
    }
  }
  return idx
}

const benchComputeds = (order: Order): number => {
  const shared = atom(0, 'shared')
  const unsubs = Array.from({ length: N }, (_, i) =>
    computed(() => shared() + i, `c${i}`).subscribe(() => {}),
  )
  notify()
  const idx = orderIndexes(order)
  const start = performance.now()
  for (const i of idx) unsubs[i]!()
  const elapsed = performance.now() - start
  notify()
  return elapsed
}

const benchListeners = (order: Order): number => {
  const shared = atom(0, 'shared')
  const unsubs = Array.from({ length: N }, () => shared.subscribe(() => {}))
  notify()
  const idx = orderIndexes(order)
  const start = performance.now()
  for (const i of idx) unsubs[i]!()
  const elapsed = performance.now() - start
  notify()
  return elapsed
}

const report = (name: string, fn: (order: Order) => number) => {
  for (const order of ['lifo', 'fifo', 'random'] as const) {
    const samples: number[] = []
    for (let r = 0; r < RUNS; r++) samples.push(fn(order))
    samples.sort((a, b) => a - b)
    const median = samples[Math.floor(samples.length / 2)]!
    console.log(
      `${name} ${order.padEnd(6)} N=${N} median=${median.toFixed(2)}ms (min=${samples[0]!.toFixed(2)} max=${samples[samples.length - 1]!.toFixed(2)})`,
    )
  }
}

report('computed graph unlink   ', benchComputeds)
report('subscribe listener unsub', benchListeners)
