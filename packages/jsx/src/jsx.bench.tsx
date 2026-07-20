import { atom, notify, reatomLinkedList, withInit } from '@reatom/core'
import { afterAll, bench, describe } from 'vitest'

// eslint-disable-next-line unused-imports/no-unused-imports
import { DEBUG, h, hf, mount } from '.'

DEBUG.extend(withInit(() => false))

const adjectives = [
  'pretty',
  'large',
  'big',
  'small',
  'tall',
  'short',
  'long',
  'handsome',
  'plain',
  'quaint',
] as const
const colors = [
  'red',
  'yellow',
  'blue',
  'green',
  'pink',
  'brown',
  'purple',
  'white',
  'black',
  'orange',
] as const
const nouns = [
  'table',
  'chair',
  'house',
  'bbq',
  'desk',
  'car',
  'pony',
  'cookie',
  'sandwich',
  'burger',
] as const

let nextId = 1

const buildLabel = () => {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]!
  const color = colors[Math.floor(Math.random() * colors.length)]!
  const noun = nouns[Math.floor(Math.random() * nouns.length)]!
  return `${adjective} ${color} ${noun}`
}

const buildRowParams = (count: number): Array<[number, string]> => {
  const params: Array<[number, string]> = []
  for (let i = 0; i < count; i++) {
    params.push([nextId, buildLabel()])
    nextId += 1
  }
  return params
}

const createRowsList = () =>
  reatomLinkedList(
    (id: number, label: string) => ({
      id,
      label: atom(label, ''),
      selected: atom(false, ''),
    }),
    '',
  )

type RowsList = ReturnType<typeof createRowsList>
type RowNode = NonNullable<ReturnType<RowsList>['head']>

/**
 * Reatom delivers subscriber effects (and so all DOM writes) in a microtask,
 * while tinybench times only the bench fn call. `notify()` drains the reactive
 * queue synchronously so DOM updates land inside the measured window, and the
 * following microtask yield lets the jsx MutationObserver run its
 * connect/teardown pass (subscribe/unsubscribe of row atoms) before the sample
 * ends.
 */
const flush = async () => {
  notify()
  // Let the MutationObserver deliver its records (queued as a microtask).
  await Promise.resolve()
  // Drain effects enqueued by the observer pass (unsubscribe/connect hooks).
  notify()
}

const mountRowsApp = (rows: RowsList) => {
  const rowElements = rows.reatomMap(
    (row) => (
      <tr class={() => (row.selected() ? 'danger' : undefined)}>
        <td>{row.id}</td>
        <td>
          <a>{row.label}</a>
        </td>
      </tr>
    ),
    '',
  )

  const host = document.createElement('div')
  document.body.append(host)
  const table = (
    <table>
      <tbody>{rowElements}</tbody>
    </table>
  )
  const { unmount } = mount(host, table)

  return {
    dispose: () => {
      unmount()
      host.remove()
    },
  }
}

const fillRows = (rows: RowsList, count: number) => {
  rows.batch(() => {
    rows.clear()
    rows.createMany(buildRowParams(count))
  })
}

/**
 * Toggles the ` !!!` suffix instead of appending it forever: cumulative appends
 * grow the label strings unboundedly across iterations, which skews later
 * samples with ever-longer Text writes.
 */
const toggleEveryTenth = (rows: RowsList) => {
  let index = 0
  rows.find((row) => {
    if (index % 10 === 0) {
      row.label.set((state) =>
        state.endsWith(' !!!') ? state.slice(0, -4) : `${state} !!!`,
      )
    }
    index += 1
    return false
  })
}

const swapSecondAndSecondLast = (rows: RowsList) => {
  const { head, tail, LL_NEXT, LL_PREV } = rows()
  const first = head?.[LL_NEXT]
  const second = tail?.[LL_PREV]
  if (first && second) {
    rows.swap(first, second)
  }
}

const benchOptions = {
  time: 300,
  warmupTime: 100,
  warmupIterations: 2,
  throws: true,
} as const

/**
 * Note on sample composition: vitest exposes only bench-level `setup` (runs
 * once per warmup/run phase, not per iteration), so scenarios that consume
 * their own state (append, clear) must restore it inside the measured fn. Those
 * samples are composites — uniform across iterations, so still valid for
 * regression tracking; subtract the `create` baseline to isolate a phase.
 */
describe('reatom/jsx keyed list (browser)', () => {
  describe('create 1_000 rows', () => {
    const rows = createRowsList()
    const { dispose } = mountRowsApp(rows)

    afterAll(dispose)

    // Steady state: each iteration clears the previous 1k and creates 1k.
    bench(
      'create 1_000 rows',
      async () => {
        fillRows(rows, 1_000)
        await flush()
      },
      benchOptions,
    )
  })

  describe('update every 10th of 1_000 rows', () => {
    const rows = createRowsList()
    const { dispose } = mountRowsApp(rows)
    fillRows(rows, 1_000)
    notify()

    afterAll(dispose)

    bench(
      'update every 10th of 1_000 rows',
      async () => {
        toggleEveryTenth(rows)
        await flush()
      },
      benchOptions,
    )
  })

  describe('append 1_000 rows to 1_000', () => {
    const rows = createRowsList()
    const { dispose } = mountRowsApp(rows)

    afterAll(dispose)

    // Composite sample: reset to 1k, then append 1k. Without the in-sample
    // reset the list would grow by 1k every iteration, so later samples would
    // measure appends into a much larger list/DOM.
    bench(
      'append 1_000 rows to 1_000',
      async () => {
        fillRows(rows, 1_000)
        await flush()
        rows.createMany(buildRowParams(1_000))
        await flush()
      },
      benchOptions,
    )
  })

  describe('swap rows in 1_000', () => {
    const rows = createRowsList()
    const { dispose } = mountRowsApp(rows)
    fillRows(rows, 1_000)
    notify()

    afterAll(dispose)

    bench(
      'swap rows in 1_000',
      async () => {
        swapSecondAndSecondLast(rows)
        await flush()
      },
      benchOptions,
    )
  })

  describe('clear 1_000 rows', () => {
    const rows = createRowsList()
    const { dispose } = mountRowsApp(rows)

    afterAll(dispose)

    // Composite sample: create 1k, then clear. A bench-level `setup` fill
    // would leave every iteration after the first clearing an empty list.
    bench(
      'clear 1_000 rows',
      async () => {
        rows.createMany(buildRowParams(1_000))
        await flush()
        rows.clear()
        await flush()
      },
      benchOptions,
    )
  })

  describe('select a row in 1_000', () => {
    const rows = createRowsList()
    const { dispose } = mountRowsApp(rows)
    fillRows(rows, 1_000)
    notify()

    afterAll(dispose)

    // Walk the selection through the list so every iteration flips the class
    // on two rows. `set(true); set(false)` on one atom coalesces into a
    // no-op within a single notify batch.
    let selected: RowNode | null = null
    bench(
      'select a row in 1_000',
      async () => {
        const state = rows()
        const next = selected?.[state.LL_NEXT] ?? state.head
        if (!next) return
        selected?.selected.set(false)
        next.selected.set(true)
        selected = next
        await flush()
      },
      benchOptions,
    )
  })
})
