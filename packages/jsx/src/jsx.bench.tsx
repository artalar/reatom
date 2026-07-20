import { atom, reatomLinkedList, withInit } from '@reatom/core'
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

const updateEveryTenth = (rows: RowsList) => {
  let index = 0
  rows.find((row) => {
    if (index % 10 === 0) {
      row.label.set((state) => `${state} !!!`)
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

describe('reatom/jsx keyed list (browser)', () => {
  describe('create 1_000 rows', () => {
    const rows = createRowsList()
    const { dispose } = mountRowsApp(rows)

    afterAll(dispose)

    bench(
      'create 1_000 rows',
      () => {
        fillRows(rows, 1_000)
      },
      benchOptions,
    )
  })

  describe('update every 10th of 1_000 rows', () => {
    const rows = createRowsList()
    const { dispose } = mountRowsApp(rows)
    fillRows(rows, 1_000)

    afterAll(dispose)

    bench(
      'update every 10th of 1_000 rows',
      () => {
        updateEveryTenth(rows)
      },
      benchOptions,
    )
  })

  describe('append 1_000 rows to 1_000', () => {
    const rows = createRowsList()
    const { dispose } = mountRowsApp(rows)

    afterAll(dispose)

    bench(
      'append 1_000 rows to 1_000',
      () => {
        rows.createMany(buildRowParams(1_000))
      },
      {
        ...benchOptions,
        setup: () => {
          fillRows(rows, 1_000)
        },
      },
    )
  })

  describe('swap rows in 1_000', () => {
    const rows = createRowsList()
    const { dispose } = mountRowsApp(rows)
    fillRows(rows, 1_000)

    afterAll(dispose)

    bench(
      'swap rows in 1_000',
      () => {
        swapSecondAndSecondLast(rows)
      },
      benchOptions,
    )
  })

  describe('clear 1_000 rows', () => {
    const rows = createRowsList()
    const { dispose } = mountRowsApp(rows)

    afterAll(dispose)

    bench(
      'clear 1_000 rows',
      () => {
        rows.clear()
      },
      {
        ...benchOptions,
        setup: () => {
          fillRows(rows, 1_000)
        },
      },
    )
  })

  describe('select a row in 1_000', () => {
    const rows = createRowsList()
    const { dispose } = mountRowsApp(rows)
    fillRows(rows, 1_000)

    afterAll(dispose)

    bench(
      'select a row in 1_000',
      () => {
        const row = rows().head
        if (!row) return
        row.selected.set(true)
        row.selected.set(false)
      },
      benchOptions,
    )
  })
})
