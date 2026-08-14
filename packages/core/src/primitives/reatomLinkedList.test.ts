import { describe, expect, subscribe, test, vi } from 'test'

import { atom, computed, isAtom, isConnected, notify } from '../core'
import { withChangeHook } from '../extensions'
import { deatomize, isCausedBy } from '../methods'
import { createMemStorage, reatomPersist } from '../persist'
import type {
  LinkedListSymbols,
  LL_NEXT,
  LL_PREV,
  LLNode,
} from './reatomLinkedList'
import { reatomLinkedList, toArray } from './reatomLinkedList'

const validateIntegrity = <T extends LLNode>(
  head: T | null,
  symbols: LinkedListSymbols,
) => {
  const LL_PREV: LL_PREV = symbols.LL_PREV
  const LL_NEXT: LL_NEXT = symbols.LL_NEXT
  let prev = null
  let current = head
  while (current) {
    if (current[LL_PREV] !== prev) {
      throw new Error(
        'Linked list integrity violation: incorrect LL_PREV pointer',
      )
    }
    prev = current
    current = current[LL_NEXT] as T | null
  }
}

test('should respect initState, create and remove elements properly', () => {
  const list = reatomLinkedList({
    create: (n: number) => atom(n),
    initState: [atom(1), atom(2)],
  })

  const last = list.create(3)
  expect(list.array().map((v) => v())).toEqual([1, 2, 3])
  list.remove(last)
  expect(deatomize(list.array)).toEqual([1, 2])

  list.remove(last)
  expect(deatomize(list.array)).toEqual([1, 2])

  list.remove(list.find((n) => n() === 1)!)
  expect(deatomize(list.array)).toEqual([2])

  list.remove(list.find((n) => n() === 2)!)
  expect(deatomize(list.array)).toEqual([])

  expect(() => {
    list.remove(list.find((n) => n() === 2)!)
  }).toThrow('The passed data is not a linked list node.')
})

test('should swap elements', () => {
  const list = reatomLinkedList((n: number) => ({ n }))
  const { array } = list.reatomMap(({ n }) => ({ n }))
  const track = subscribe(computed(() => array().map(({ n }) => n)))
  const one = list.create(1)
  const two = list.create(2)
  const three = list.create(3)
  const four = list.create(4)
  notify()
  expect(track.mock.lastCall?.[0]).toEqual([1, 2, 3, 4])

  list.swap(four, two)
  notify()
  expect(track.mock.lastCall?.[0]).toEqual([1, 4, 3, 2])

  list.swap(two, four)
  notify()
  expect(track.mock.lastCall?.[0]).toEqual([1, 2, 3, 4])

  list.swap(three, four)
  notify()
  expect(track.mock.lastCall?.[0]).toEqual([1, 2, 4, 3])

  list.swap(four, three)
  notify()
  expect(track.mock.lastCall?.[0]).toEqual([1, 2, 3, 4])

  list.remove(two)
  notify()
  expect(track.mock.lastCall?.[0]).toEqual([1, 3, 4])

  list.remove(three)
  notify()
  expect(track.mock.lastCall?.[0]).toEqual([1, 4])

  list.swap(four, one)
  notify()
  expect(track.mock.lastCall?.[0]).toEqual([4, 1])

  list.swap(four, one)
  notify()
  expect(track.mock.lastCall?.[0]).toEqual([1, 4])

  list.remove(one)
  notify()
  expect(track.mock.lastCall?.[0]).toEqual([4])

  list.clear()
  notify()
  expect(deatomize(list.array)).toEqual([])
})

test('should move elements', () => {
  const list = reatomLinkedList((n: number) => ({ n }))
  const one = list.create(1)
  // @ts-expect-error
  const two = list.create(2)
  // @ts-expect-error
  const three = list.create(3)
  const four = list.create(4)
  const track = subscribe(list.array)

  expect(track.mock.lastCall?.[0].map(({ n }) => n)).toEqual([1, 2, 3, 4])

  list.move(one, four)
  notify()
  expect(track.mock.lastCall?.[0].map(({ n }) => n)).toEqual([2, 3, 4, 1])
  expect(track).toBeCalledTimes(2)

  list.move(one, four)
  notify()
  expect(track.mock.lastCall?.[0].map(({ n }) => n)).toEqual([2, 3, 4, 1])
  expect(track).toBeCalledTimes(2)

  list.move(one, null)
  notify()
  expect(track.mock.lastCall?.[0].map(({ n }) => n)).toEqual([1, 2, 3, 4])
})

test('should respect node keys even if it is an atom', () => {
  const list = reatomLinkedList({
    create: (id: string) => ({ id: atom(id) }),
    key: 'id',
    initState: [{ id: atom('1') }, { id: atom('2') }],
  })
  const track = subscribe(computed(() => [...list.map().keys()]))

  expect(track.mock.lastCall?.[0]).toEqual(['1', '2'])

  list.map().get('1')?.id.set('0')
  notify()
  expect(track.mock.lastCall?.[0]).toEqual(['0', '2'])
})

test('should correctly handle batching and cause tracking', () => {
  const callCause = vi.fn(() =>
    isCausedBy(list.create)
      ? 'create'
      : isCausedBy(list.batch)
        ? 'batch'
        : 'unknown',
  )

  const list = reatomLinkedList(() => ({})).extend(withChangeHook(callCause))

  list.create()
  notify()
  expect(callCause).toReturnWith('create')

  list.batch(() => {
    list.create()
    list.create()
  })

  notify()
  expect(callCause).toReturnWith('batch')
})

test('should remove a single node', () => {
  const list = reatomLinkedList((n: number) => ({ n }))

  const node = list.create(1)
  notify()
  expect(list.array()).toEqual([
    { n: 1, [list.LL_PREV]: null, [list.LL_NEXT]: null },
  ])
  expect(list().size).toBe(1)

  list.remove(node)
  notify()
  expect(list.array()).toEqual([])
  expect(list().size).toBe(0)

  list.remove(node)
  notify()
  expect(list.array()).toEqual([])
  expect(list().size).toBe(0)
})

test('should respect initSnapshot for initializing', () => {
  const list = reatomLinkedList({
    create: (id: string) => ({ id: atom(id) }),
    key: 'id',
    initSnapshot: [['1'], ['2']],
  })
  const track = subscribe(computed(() => [...list.map().keys()]))

  expect(track.mock.lastCall?.[0]).toEqual(['1', '2'])

  list.map().get('1')?.id.set('0')
  notify()
  expect(track.mock.lastCall?.[0]).toEqual(['0', '2'])
})

test('should accept array as initState', () => {
  const list = reatomLinkedList([atom(1), atom(2)])

  expect(list.array().every(isAtom)).toBeTruthy()

  list.create(atom(3))
  notify()
  expect(list.array().every(isAtom)).toBeTruthy()
  expect(list.array().length).toBe(3)
})

test('should accept only initState and key optionally', () => {
  const list = reatomLinkedList({
    initState: [{ id: atom('1') }, { id: atom('2') }],
    key: 'id',
  })

  const keys = computed(() => [...list.map().keys()])
  const track = subscribe(keys)

  expect(track).toBeCalledWith(['1', '2'])
  expect(isConnected(list.map().get('1')!.id)).toBe(true)

  list.map().get('1')!.id.set('0')
  notify()
  expect(deatomize(list)).toStrictEqual([{ id: '0' }, { id: '2' }])
  expect(keys()).toStrictEqual(['0', '2'])
  expect(track).toBeCalledWith(['0', '2'])
})

test('should maintain linked list integrity after moves', () => {
  const list = reatomLinkedList((n: number) => ({ n }))

  const one = list.create(1)
  const two = list.create(2)
  const three = list.create(3)
  const four = list.create(4)
  notify()

  validateIntegrity(list().head, list)
  expect(list.array().map(({ n }) => n)).toEqual([1, 2, 3, 4])

  list.move(one, two)
  notify()
  validateIntegrity(list().head, list)
  expect(list.array().map(({ n }) => n)).toEqual([2, 1, 3, 4])

  list.move(four, null)
  notify()
  validateIntegrity(list().head, list)
  expect(list.array().map(({ n }) => n)).toEqual([4, 2, 1, 3])

  list.move(one, three)
  notify()
  validateIntegrity(list().head, list)
  expect(list.array().map(({ n }) => n)).toEqual([4, 2, 3, 1])

  list.move(four, one)
  notify()
  validateIntegrity(list().head, list)
  expect(list.array().map(({ n }) => n)).toEqual([2, 3, 1, 4])

  list.move(one, null)
  list.move(two, one)
  list.move(three, two)
  list.move(four, three)
  notify()
  validateIntegrity(list().head, list)
  expect(list.array().map(({ n }) => n)).toEqual([1, 2, 3, 4])
})

test('should maintain linked list integrity after swaps', () => {
  const list = reatomLinkedList((n: number) => ({ n }))

  const one = list.create(1)
  const two = list.create(2)
  const three = list.create(3)
  const four = list.create(4)
  notify()

  validateIntegrity(list().head, list)
  expect(list.array().map(({ n }) => n)).toEqual([1, 2, 3, 4])

  list.swap(one, two)
  notify()
  validateIntegrity(list().head, list)
  expect(list.array().map(({ n }) => n)).toEqual([2, 1, 3, 4])

  list.swap(one, two)
  notify()
  validateIntegrity(list().head, list)
  expect(list.array().map(({ n }) => n)).toEqual([1, 2, 3, 4])

  list.swap(one, three)
  notify()
  validateIntegrity(list().head, list)
  expect(list.array().map(({ n }) => n)).toEqual([3, 2, 1, 4])

  list.swap(one, four)
  notify()
  validateIntegrity(list().head, list)
  expect(list.array().map(({ n }) => n)).toEqual([3, 2, 4, 1])

  list.swap(three, one)
  notify()
  validateIntegrity(list().head, list)
  expect(list.array().map(({ n }) => n)).toEqual([1, 2, 4, 3])

  list.swap(four, two)
  notify()
  validateIntegrity(list().head, list)
  expect(list.array().map(({ n }) => n)).toEqual([1, 4, 2, 3])
})

test('should create many items at once', () => {
  const list = reatomLinkedList((n: number) => ({ n }))
  const track = subscribe(list.array)

  const nodes = list.createMany([[1], [2], [3], [4]])
  notify()

  expect(nodes.length).toBe(4)
  expect(track.mock.lastCall?.[0].map(({ n }) => n)).toEqual([1, 2, 3, 4])
  expect(list().size).toBe(4)
  expect(list().changes.length).toBe(1)
  expect(list().changes[0]!.kind).toBe('createMany')
  const change = list().changes[0]
  expect(change?.kind === 'createMany' && change.nodes).toEqual(nodes)
})

test('should remove many items at once', () => {
  const list = reatomLinkedList((n: number) => ({ n }))
  const track = subscribe(list.array)

  const nodes = list.createMany([[1], [2], [3], [4]])
  notify()
  expect(track.mock.lastCall?.[0].map(({ n }) => n)).toEqual([1, 2, 3, 4])

  const removedCount = list.removeMany([nodes[1]!, nodes[3]!])
  notify()

  expect(removedCount).toBe(2)
  expect(track.mock.lastCall?.[0].map(({ n }) => n)).toEqual([1, 3])
  expect(list().size).toBe(2)
  expect(list().changes.length).toBe(1)
  expect(list().changes[0]!.kind).toBe('removeMany')
  const change = list().changes[0]
  expect(change?.kind === 'removeMany' && change.nodes).toEqual([
    nodes[1],
    nodes[3],
  ])
})

test('should handle removeMany with already removed nodes', () => {
  const list = reatomLinkedList((n: number) => ({ n }))

  const nodes = list.createMany([[1], [2], [3]])
  notify()

  list.remove(nodes[1]!)
  notify()

  const removedCount = list.removeMany([nodes[0]!, nodes[1]!, nodes[2]!])
  notify()

  expect(removedCount).toBe(2)
  expect(list.array().map(({ n }) => n)).toEqual([])
  expect(list().size).toBe(0)
})

test('should track createMany and removeMany with reatomMap', () => {
  const list = reatomLinkedList((n: number) => ({ n }))
  const mapped = list.reatomMap(({ n }) => ({ doubled: n * 2 }))
  const track = subscribe(
    computed(() => mapped.array().map(({ doubled }) => doubled)),
  )

  list.createMany([[1], [2], [3]])
  notify()
  expect(track.mock.lastCall?.[0]).toEqual([2, 4, 6])
  expect(mapped().changes.length).toBe(1)
  expect(mapped().changes[0]!.kind).toBe('createMany')

  const nodes = list.array()
  list.removeMany([nodes[0]!, nodes[2]!])
  notify()
  expect(track.mock.lastCall?.[0]).toEqual([4])
  expect(mapped().changes.length).toBe(1)
  expect(mapped().changes[0]!.kind).toBe('removeMany')
})

test('should keep changes payload readable synchronously after a follow-up update', () => {
  const list = reatomLinkedList((n: number) => ({ n }))

  list.createMany([[1], [2]])
  const state = list()

  list.create(3)

  const change = state.changes[0]!
  expect(change.kind).toBe('createMany')
  expect(
    change.kind === 'createMany' && change.nodes.map(({ n }) => n),
  ).toEqual([1, 2])

  notify()
  expect(state.changes).toEqual([])
})

test('should keep changes payload intact for a subscriber doing a re-entrant update', () => {
  const list = reatomLinkedList((n: number) => ({ n }))

  // Mirror consumer: incrementally applies `state.changes` to an external
  // structure — the same contract as jsx `walkLinkedList` and `reatomMap`.
  const mirror = new Set<number>()
  list.subscribe((state) => {
    // A "capped list" invariant: react to overflow with a re-entrant update
    // before syncing the notification payload.
    if (state.size > 2) {
      list.remove(state.head!)
    }

    for (const change of state.changes) {
      if (change.kind === 'create') {
        mirror.add(change.node.n)
      } else if (change.kind === 'createMany') {
        for (const node of change.nodes) mirror.add(node.n)
      } else if (change.kind === 'remove') {
        mirror.delete(change.node.n)
      } else if (change.kind === 'removeMany') {
        for (const node of change.nodes) mirror.delete(node.n)
      }
    }
  })

  list.createMany([[1], [2], [3]])
  notify()

  expect(list.array().map(({ n }) => n)).toEqual([2, 3])
  expect([...mirror]).toEqual([2, 3])
})

test('should allow using element from one list in another list via list-specific symbols', () => {
  const listA = reatomLinkedList((n: number) => ({ n }))
  const listB = reatomLinkedList((n: number) => ({ n }))

  const nodeInA = listA.create(1)
  listA.create(2)
  notify()

  expect(listA.LL_PREV).not.toBe(listB.LL_PREV)

  const nodeInB = listB.create(10)
  listB.create(20)
  listB.create(30)
  notify()

  expect(listB.array().map(({ n }) => n)).toEqual([10, 20, 30])

  const prevInB = nodeInB[listB.LL_PREV]
  expect(prevInB).toBeNull()

  const nextInB = nodeInB[listB.LL_NEXT]
  expect(nextInB?.n).toBe(20)

  expect(nodeInA).not.toBe(nodeInB)
})

describe('serialization / deserialization', () => {
  test('should serialize atom nodes to JSON as plain array', () => {
    const name = 'linkedListSerialization'

    const list = reatomLinkedList(
      {
        create: (n: number) => atom(n, `${name}.list#${n}`),
        initState: [atom(1), atom(2)],
      },
      `${name}.list`,
    )

    expect(JSON.parse(JSON.stringify(list))).toEqual([1, 2])
  })

  test('should persist and restore linked list via mem storage', () => {
    const name = 'linkedListPersist'

    const persistStorage = createMemStorage({ name })
    const withPersist = reatomPersist(persistStorage)

    const key = `${name}.list`

    persistStorage.snapshotAtom.set({
      [key]: {
        data: [1, 2, 3],
        id: 0,
        timestamp: Date.now(),
        to: Date.now() + 10000,
        version: 0,
      },
    })

    const list = reatomLinkedList(
      (n: number) => atom(n, `${name}.list#${n}`),
      key,
    ).extend(
      withPersist({
        key,
        toSnapshot: (state) => deatomize(toArray(state)),
      }),
    )

    expect(deatomize(list)).toEqual([1, 2, 3])

    list.create(4)
    expect(deatomize(list)).toEqual([1, 2, 3, 4])

    expect(persistStorage.snapshotAtom()[key]?.data).toEqual([1, 2, 3, 4])
  })
})
