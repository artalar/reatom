import { expect, test } from 'test'

import { _read, action, atom, notify } from '../core'
import { withChangeHook } from '../extensions'
import { sleep } from '../utils'
import { isCausedBy, wrap } from '.'
import { withRollback, withTransaction } from './transaction'

test('optimistic update with automatic rollback', async () => {
  const like = atom(false, 'like')
    .extend(withRollback())
    .extend((target) => ({
      toggle: action(async () => {
        target.set((state) => !state)
        await wrap(sleep())
        throw new Error('test')
      }, `${target.name}.toggle`).extend(withTransaction()),
    }))

  expect(like()).toBe(false)
  like.toggle()
  expect(like()).toBe(true)

  await wrap(sleep(10))
  expect(like()).toBe(false)
})

test('manual rollback with multiple atoms and outdated rollback', () => {
  const name = atom('', 'name').extend(withRollback())
  const email = atom('', 'email').extend(withRollback())
  const age = atom(0, 'age').extend(withRollback())

  const updateProfile = action(
    (data: { name: string; email: string; age: number }) => {
      name.set(data.name)
      email.set(data.email)
      age.set(data.age)
    },
    'updateProfile',
  ).extend(withTransaction())

  expect(name()).toBe('')
  expect(email()).toBe('')
  expect(age()).toBe(0)

  updateProfile({ name: 'Alice', email: 'alice@example.com', age: 30 })
  expect(name()).toBe('Alice')
  expect(email()).toBe('alice@example.com')
  expect(age()).toBe(30)

  // make one of the rollback outdated
  age.set(31)
  updateProfile.rollback()
  expect(name()).toBe('')
  expect(email()).toBe('')
  expect(age()).toBe(31)
})

test('rollback executes in reverse order (LIFO)', () => {
  const executionOrder: any[] = []

  const first = atom(1, 'first').extend(
    withRollback(),
    withChangeHook(() => executionOrder.push(1)),
  )
  const second = atom(2, 'second').extend(
    withRollback(),
    withChangeHook(() => executionOrder.push(2)),
  )
  const third = atom(3, 'third').extend(
    withRollback(),
    withChangeHook(() => executionOrder.push(3)),
  )

  const updateAll = action(() => {
    first.set(10)
    second.set(20)
    third.set(30)
  }, 'updateAll').extend(withTransaction())

  updateAll()
  notify()
  executionOrder.push('rollback')
  updateAll.rollback()

  expect(first()).toBe(1)
  expect(second()).toBe(2)
  expect(third()).toBe(3)
  notify()
  expect(executionOrder).toEqual([1, 2, 3, 'rollback', 3, 2, 1])
})

test('custom onRollback callback transforms state during rollback', () => {
  const list = atom<string[]>([], 'list').extend(
    withRollback({
      onRollback: ({ beforeState, transactionState, currentState }) => {
        const addedItems = transactionState.filter(
          (item) => !beforeState.includes(item),
        )
        return currentState.filter((item) => !addedItems.includes(item))
      },
    }),
  )

  const addItem = action((item: string) => {
    list.set((items) => [...items, item])
  }, 'addItem').extend(withTransaction())

  list.set(['initial'])
  expect(list()).toEqual(['initial'])

  addItem('optimistic')
  expect(list()).toEqual(['initial', 'optimistic'])

  list.set((items) => [...items, 'concurrent'])
  expect(list()).toEqual(['initial', 'optimistic', 'concurrent'])

  addItem.rollback()
  expect(list()).toEqual(['initial', 'concurrent'])
})

test('synchronous error triggers rollback', () => {
  const state = atom('initial', 'state').extend(withRollback())

  const failingAction = action(() => {
    state.set('changed')
    throw new Error('Sync error')
  }, 'failingAction').extend(withTransaction())

  expect(state()).toBe('initial')

  expect(() => failingAction()).toThrow('Sync error')

  expect(state()).toBe('initial')
})

test('each action call has its own rollback scope', () => {
  const counter = atom(0, 'counter').extend(withRollback())

  const increment = action(() => {
    counter.set((n) => n + 1)
  }, 'increment').extend(withTransaction())

  increment()
  expect(counter()).toBe(1)

  increment()
  expect(counter()).toBe(2)

  increment()
  expect(counter()).toBe(3)

  increment.rollback()
  expect(counter()).toBe(2)
})

test('nested transactions rollback through action cause chain', () => {
  const parentState = atom(0, 'parentState').extend(withRollback())
  const childState = atom(0, 'childState').extend(withRollback())

  const child = action(() => {
    childState.set(2)
  }, 'child').extend(withTransaction())

  const parent = action(() => {
    parentState.set(1)
    child()
  }, 'parent').extend(withTransaction())

  parent()
  expect(parentState()).toBe(1)
  expect(childState()).toBe(2)

  parent.rollback()
  expect(parentState()).toBe(0)
  expect(childState()).toBe(0)
})

test('rollback scope should not leak', async () => {
  const doSome = action(async () => {
    await wrap(sleep())
    throw new Error('test')
  }, 'doSome').extend(withTransaction())

  const counter = atom(0, 'counter').extend(
    withRollback(),
    // hook should preserve the cause, but not leak the rollback
    withChangeHook(doSome),
  )

  counter.set((s) => s + 1)
  expect(counter()).toBe(1)

  await wrap(sleep(10))
  expect(counter()).toBe(1)
  expect(_read(doSome)!.run(() => isCausedBy(counter))).toBe(true)
})

test('shouldRollback filters which errors trigger rollback', () => {
  const counter = atom(0, 'counter').extend(withRollback())

  class ValidationError extends Error {}
  class NetworkError extends Error {}

  const actionWithFilter = action((shouldThrow: 'validation' | 'network') => {
    counter.set((n) => n + 1)
    if (shouldThrow === 'validation') throw new ValidationError()
    if (shouldThrow === 'network') throw new NetworkError()
  }, 'actionWithFilter').extend(
    withTransaction({
      shouldRollback: (error) => error instanceof ValidationError,
    }),
  )

  expect(counter()).toBe(0)

  expect(() => actionWithFilter('validation')).toThrow(ValidationError)
  expect(counter()).toBe(0)

  expect(() => actionWithFilter('network')).toThrow(NetworkError)
  expect(counter()).toBe(1)
})

test('stop clears rollback list without executing', () => {
  const counter = atom(0, 'counter').extend(withRollback())

  const increment = action(() => {
    counter.set((n) => n + 1)
  }, 'increment').extend(withTransaction())

  expect(counter()).toBe(0)

  increment()
  expect(counter()).toBe(1)

  increment.stop()
  increment.rollback()
  expect(counter()).toBe(1)
})

test('rollback survives an action invoked through a subscriber-created wrap', async () => {
  const like = atom(true, 'like').extend(withRollback())
  const toggle = action(async () => {
    like.set((state) => !state)
    await wrap(sleep())
    throw new Error('test')
  }, 'like.toggle').extend(withTransaction())

  // ≈ UI bindings (reatom-react): every state change re-renders, and the render re-creates
  // the click handler via `wrap` INSIDE the subscription callback. Since subscribers run in
  // the atom's live frame, the handler binds to it — so once a rollback becomes the atom's
  // last writer, the next call's writes all satisfy `isCausedBy(transactionVar.rollback)`
  // and withRollback silently skips registering their undos: the queue stays empty and the
  // transaction has nothing to roll back. (The state the click left behind then makes the
  // NEXT call clean again — in the UI this reads as rollback working every other click.)
  let handler!: () => Promise<void>
  const unsubscribe = like.subscribe(() => {
    handler = wrap(async () => {
      try {
        await wrap(toggle())
      } catch {
        // the rollback is expected to have restored the state
      }
    })
  })

  await wrap(handler()) // 1st failing toggle → optimistic flip is rolled back
  expect(like()).toBe(true)

  await wrap(handler()) // 2nd failing toggle — must roll back the same way
  expect(like()).toBe(true)

  unsubscribe()
})
