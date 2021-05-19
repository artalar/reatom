import { test } from 'uvu'
import * as assert from 'uvu/assert'

import {
  ActionCreator,
  createStore,
  createTransaction,
  declareAction,
  declareAtom,
  Fn,
  Store,
} from '.'
// import { declareResource } from './experiments/declareResource'

let noop: Fn = () => {}

const sleep = (ms = 0) => new Promise((r) => setTimeout(r, ms))

export function mockFn<I extends any[], O>(
  fn: Fn<I, O> = (...i: any) => void 0 as any,
) {
  const _fn = Object.assign(
    function (...i: I) {
      // @ts-ignore
      const o = fn.apply(this, i)

      _fn.calls.push({ i, o })

      return o
    },
    {
      calls: new Array<{ i: I; o: O }>(),
      lastInput(): I[0] {
        const { length } = _fn.calls
        if (length === 0) throw new TypeError(`Array is empty`)
        return _fn.calls[length - 1].i[0]
      },
    },
  )

  return _fn
}

test(`displayName`, () => {
  const setFirstName = declareAction<string>(`setFirstName`)
  const setFullName = declareAction<string>(`setFullName`)
  const firstNameAtom = declareAtom(($, state = 'John') => {
    $(setFirstName, (name) => (state = name))
    $(setFullName, (fullName) => (state = fullName.split(' ')[0]))
    return state
  }, `firstName`)

  const lastNameAtom = declareAtom(($, state = 'Doe') => {
    $(setFullName, (fullName) => (state = fullName.split(' ')[1]))
    return state
  }, `lastName`)

  const isFirstNameShortAtom = declareAtom(
    ($) => $(firstNameAtom).length < 10,
    `isFirstNameShort`,
  )

  const fullNameAtom = declareAtom(
    ($) => `${$(firstNameAtom)} ${$(lastNameAtom)}`,
    `fullName`,
  )

  const displayNameAtom = declareAtom(
    ($) => ($(isFirstNameShortAtom) ? $(fullNameAtom) : $(firstNameAtom)),
    `displayName`,
  )

  const store = createStore()

  const cb = mockFn()

  store.subscribe(displayNameAtom, cb)

  assert.is(cb.calls.length, 1)
  assert.is(cb.lastInput(), 'John Doe')

  store.dispatch(setFirstName('John'))
  assert.is(cb.calls.length, 1)
  assert.is(cb.lastInput(), 'John Doe')

  store.dispatch(setFirstName('Joe'))
  assert.is(cb.calls.length, 2)
  assert.is(cb.lastInput(), 'Joe Doe')

  store.dispatch(setFirstName('Joooooooooooooooooooe'))
  assert.is(cb.calls.length, 3)
  assert.is(cb.lastInput(), 'Joooooooooooooooooooe')

  store.dispatch(setFirstName('Joooooooooooooooooooe'))
  assert.is(cb.calls.length, 3)
  assert.is(cb.lastInput(), 'Joooooooooooooooooooe')

  console.log(`👍`)
})

test(`combine`, () => {
  const aAtom = declareAtom(0)
  const bAtom = declareAtom(($) => $(aAtom) % 2)
  const cAtom = declareAtom(($) => $(aAtom) % 2)
  const bcAtom = declareAtom(($) => ({
    b: $(bAtom),
    c: $(cAtom),
  }))
  const store = createStore()
  store.init(bcAtom)

  const bsState1 = store.getState(bcAtom)
  assert.is(store.getState(aAtom), 0)
  assert.equal(bsState1, { b: 0, c: 0 })

  store.dispatch(aAtom.update((s) => s + 1))
  const bsState2 = store.getState(bcAtom)
  assert.is(store.getState(aAtom), 1)
  assert.equal(bsState2, { b: 1, c: 1 })

  store.dispatch(aAtom.update((s) => s + 2))
  const bsState3 = store.getState(bcAtom)
  assert.is(store.getState(aAtom), 3)
  assert.equal(bsState3, { b: 1, c: 1 })
  assert.is(bsState2, bsState3)

  console.log(`👍`)
})

test(`atom id`, () => {
  const a = declareAtom(1, `a`)
  const b = declareAtom(($, s = 2) => s, { id: `b` })
  const c = declareAtom(($) => $(a), { id: `c` })
  const store = createStore()

  store.init(a, b, c)

  assert.equal(store.getState(), { a: 1, b: 2, c: 1 })

  console.log(`👍`)
})

test(`action mapper`, () => {
  const action = declareAction((payload: number) => ({
    payload: payload + 1,
  }))
  assert.is(action(1).payload, 2)

  console.log(`👍`)
})

test(`atom filter`, () => {
  const track = mockFn()
  const aAtom = declareAtom(0)
  const bAtom = declareAtom(($, s = 0) => {
    track()

    const a = $(aAtom)
    if (a % 2) s = a
    return s
  })

  const bCache1 = bAtom(createTransaction([]))
  assert.is(track.calls.length, 1)
  assert.is(bCache1.state, 0)

  const bCache2 = bAtom(createTransaction([]), bCache1)
  assert.is(track.calls.length, 1)
  assert.is(bCache1, bCache2)

  const bCache3 = bAtom(createTransaction([aAtom.update(0)]), bCache2)
  assert.is(track.calls.length, 1)
  assert.is(bCache2, bCache3)
  assert.is(bCache2.state, bCache3.state)

  const bCache4 = bAtom(createTransaction([aAtom.update(1)]), bCache3)
  assert.is(track.calls.length, 2)
  assert.is.not(bCache3, bCache4)
  assert.is.not(bCache3.state, bCache4.state)

  console.log(`👍`)
})

test(`in atom action effect`, async () => {
  function declareResource<I, O>(fetcher: (params: I) => Promise<O>) {
    const request = declareAction<I>()
    const response = declareAction<O | Error>()

    return Object.assign(
      declareAtom(($, state = null as null | O | Error) => {
        $(
          request,
          (payload) =>
            ({ dispatch }) =>
              fetcher(payload)
                .then((data) => dispatch(response(data)))
                .catch((e) =>
                  dispatch(response(e instanceof Error ? e : new Error(e))),
                ),
        )

        $(response, (payload) => (state = payload))

        return state
      }),
      { request },
    )
  }

  const dataAtom = declareResource((params: void) => Promise.resolve([]))
  const cb = mockFn()

  const store = createStore()

  store.subscribe(dataAtom, cb)
  assert.is(cb.calls.length, 1)
  assert.is(cb.lastInput(), null)

  store.dispatch(dataAtom.request())
  assert.is(cb.calls.length, 1)
  await sleep()
  assert.is(cb.calls.length, 2)
  assert.equal(cb.lastInput(), [])

  console.log(`👍`)
})

test(`action effect example`, () => {
  function handleEffects(store: Store) {
    store.subscribe(({ actions }) =>
      actions.forEach((action) => action.effect?.(store)),
    )
  }

  const effect = mockFn()
  const doEffect = declareAction(() => ({
    payload: null,
    effect,
  }))
  const store = createStore()

  handleEffects(store)

  store.dispatch(doEffect())

  assert.is(effect.calls.length, 1)
  assert.is(effect.lastInput(), store)

  console.log(`👍`)
})

test(`Atom store dependency states`, () => {
  const aTrack = mockFn()
  const incrementA = declareAction()
  const noopAction = declareAction()
  const aAtom = declareAtom(($, state = 1) => {
    aTrack()
    $(incrementA, () => (state += 1))
    return state
  })
  const bAtom = declareAtom(($) => $(aAtom) + 1)

  const bCache1 = bAtom(createTransaction([noopAction()]))
  assert.is(aTrack.calls.length, 1)

  const bCache2 = bAtom(createTransaction([noopAction()]), bCache1)
  assert.is(aTrack.calls.length, 1)
  assert.is(bCache1, bCache2)

  assert.is(bCache2.state, 2)
  const bCache3 = bAtom(createTransaction([incrementA()]), bCache1)
  assert.is(aTrack.calls.length, 2)
  assert.is(bCache3.state, 3)

  console.log(`👍`)
})

test(`Atom from`, () => {
  const atom = declareAtom(42)

  assert.is(atom(createTransaction([declareAction()()])).state, 42)
  assert.is(atom(createTransaction([atom.update(43)])).state, 43)
  assert.is(atom(createTransaction([atom.update((s) => s + 2)])).state, 44)

  console.log(`👍`)
})

test(`Store preloaded state`, () => {
  const atom = declareAtom(0)
  const snapshotLessStore = createStore()
  const snapshotFullStore = createStore({
    [atom.id]: 42,
  })

  assert.is(snapshotLessStore.getState(atom), 0)
  assert.is(snapshotFullStore.getState(atom), 42)

  snapshotLessStore.init(atom)
  snapshotFullStore.init(atom)

  assert.is(snapshotLessStore.getState(atom), 0)
  assert.is(snapshotFullStore.getState(atom), 42)

  snapshotLessStore.dispatch(atom.update((s) => s + 1))
  snapshotFullStore.dispatch(atom.update((s) => s + 1))

  assert.is(snapshotLessStore.getState(atom), 1)
  assert.is(snapshotFullStore.getState(atom), 43)

  console.log(`👍`)
})

test(`Batched dispatch`, () => {
  const atom = declareAtom(0)
  const store = createStore()
  const cb = mockFn()

  store.subscribe(atom, cb)

  assert.is(cb.calls.length, 1)

  store.dispatch([atom.update((s) => s + 1), atom.update((s) => s + 1)])
  assert.is(cb.calls.length, 2)
  assert.is(cb.lastInput(), 2)

  console.log(`👍`)
})

test(`Batched dispatch dynamic types change`, () => {
  let computerCalls = 0
  const doSome = declareAction<any>()
  const addAction = declareAction<ActionCreator>()
  const actionsCacheAtom = declareAtom(
    ($, state = new Array<readonly [ActionCreator, any]>()) => {
      computerCalls++
      $(
        addAction,
        (actionCreator) => (state = [...state, [actionCreator, null]]),
      )

      return state.map(([actionCreator, payload = null]) => {
        $(actionCreator, (v) => (payload = v))
        return [actionCreator, payload] as const
      })
    },
  )
  const store = createStore()

  store.init(actionsCacheAtom)
  assert.is(computerCalls, 1)

  store.dispatch([addAction(doSome), doSome(0)])
  assert.equal(store.getState(actionsCacheAtom), [[doSome, 0]])
  assert.is(computerCalls, 2)

  console.log(`👍`)
})

test(`async collection of transaction.effectsResult`, async () => {
  const doA = declareAction()
  const doB = declareAction()

  const resourceDataAtom = declareAtom(0)
  const resourceAtom = declareAtom(($) => {
    $(doA, () => async ({ dispatch }) => {
      await sleep(10)
      await dispatch(doB())
    })

    $(doB, () => async ({ dispatch }) => {
      await sleep(10)
      await dispatch(resourceDataAtom.update((s) => s + 1))
    })

    return $(resourceDataAtom)
  })

  const store = createStore()
  const cb = mockFn()

  store.init(resourceAtom)

  store.dispatch(doA()).then(cb)

  assert.is(cb.calls.length, 0)

  await sleep(10)

  assert.is(cb.calls.length, 0)

  await sleep(10)

  assert.is(cb.calls.length, 1)

  console.log(`👍`)
})

test(`declareResource`, async () => {
  const resourceAtom = declareResource([0], (param: number) =>
    typeof param === 'number'
      ? Promise.resolve([param])
      : Promise.reject(new Error(param)),
  )

  const store = createStore()
  const cb = mockFn()

  store.subscribe(resourceAtom, cb)
  assert.is(cb.calls.length, 1)
  assert.equal(cb.lastInput(), null)

  store.dispatch(resourceAtom.get(42))
  assert.is(cb.calls.length, 1)
  assert.equal(cb.lastInput(), null)
  await sleep()
  cb.lastInput() //?
  assert.is(cb.calls.length, 2)
  assert.equal(cb.lastInput(), [42])

  const state = store.getState(resourceAtom)
  store.dispatch(resourceAtom.get(42))
  assert.is(cb.calls.length, 2)
  assert.is(cb.lastInput(), state)
  await sleep()
  assert.is(cb.calls.length, 2)
  assert.is(cb.lastInput(), state)

  store.dispatch(resourceAtom.req(42))
  assert.is(cb.calls.length, 2)
  await sleep()
  assert.is(cb.calls.length, 3)
  assert.equal(cb.lastInput(), state)

  store.dispatch(resourceAtom.req('42' as any))
  assert.is(cb.calls.length, 3)
  await sleep()
  assert.is(cb.calls.length, 4)
  assert.equal(cb.lastInput(), new Error('42'))

  store.dispatch(resourceAtom.req(1))
  store.dispatch(resourceAtom.req(2))
  store.dispatch(resourceAtom.req(3))
  assert.is(cb.calls.length, 4)
  await sleep()
  assert.is(cb.calls.length, 5)
  assert.equal(cb.lastInput(), [3])

  console.log(`👍`)
})

test.run()
