# History of API / architecture choices

## Notes

- API like `$(doSome): Action<Some>` is impossible API because an dispatch may includes a few same actions with different payload

## Options variants

### Options builder

Features

- good looking (positive feedback)
- easy to reuse methods (`on` / `meta` etc)
- customizable execution order

Problems

- Support of custom execution order
- Support of partial methods availability (to prevent redeclarations)
- How to read other atoms in reducers?

```ts
const add = declareAction<number>()

const counterAtom = declareAtom(0, (atom) =>
  atom
    .id(`counter`)
    .meta({ updates: 0 })
    .on(add, (value, state) => state + value)
    .compute(($, state) =>
      $(shouldSyncCounterAtom) ? $(globalCounterAtom) : state,
    )
    .assign({
      inc: (value: void, state) => state + 1,
    })
    .change((state, store, meta) =>
      console.log(
        `counterAtom receive new value: ${state}.`,
        `It is ${++meta.updates} update`,
      ),
    ),
)
```

### Options object 1

```ts
const add = declareAction<number>()

const counterAtom = declareAtom(0, {
  id: `counter`,
  meta: { updates: 0 },
  on: [add.reduce((value, state) => state + value)],
  compute: [
    ($, state) => ($(shouldSyncCounterAtom) ? $(globalCounterAtom) : state),
  ],
  assign: {
    inc: (value: void, state) => state + 1,
  },
  change: [
    (state, store, meta) =>
      console.log(
        `counterAtom receive new value: ${state}.`,
        `It is ${++meta.updates} update`,
      ),
  ],
})
```

### Options tuples

```ts
const add = declareAction<number>()

const counterAtom = declareAtom(
  0,
  [`id`, `counter`],
  [`meta`, { updates: 0 }],
  [add, (value, state) => state + value],
  [`inc`, (value: void, state) => state + 1],
  ($, state) => ($(shouldSyncCounterAtom) ? $(globalCounterAtom) : state),
  [
    `*`,
    (state) => (store, meta) =>
      console.log(
        `counterAtom receive new value: ${state}.`,
        `It is ${++meta.updates} update`,
      ),
  ],
)
```

## Options operators

```ts
const add = declareAction()

const counterAtom = declareAtom(
  {
    state: 0,
    id: `counter`,
    meta: { updates: 0 },
    actions: {
      add: (action: ActionCreator<[123]>) => reduce(action),
    },
  },
  ($, state) => ($(shouldSyncCounterAtom) ? $(globalCounterAtom) : state),
  reduce(add, (value, state) => state + value),
  sample(add, ($, state) => state + $(someAtom)),
  handle(add, (action, state) => ({
    state,
    effect: async (store) => {},
  })),
  change((oldState, newState) => newState),
)
```

### Options object 2

Limitations

- Can't handle both state and effect in methods
- Can't choose the order of execution between methods and computer

```ts
const add = declareAction<number>()

const counterAtom = declareAtom(0, {
  id: `counter`,
  ctx: { updates: 0 },
  methods: {
    inc: (value:void, state) => state + 1,
  },
  computer: ($, state) => {
    $(add, (value) => state += value))

    if ($(shouldSyncCounterAtom)) {
      $(globalCounterAtom, (globalCounter) => state = globalCounter)
    }

    return state
  }
  change: (newState, state) => (store, ctx) =>
    console.log(
      `counterAtom receive new value: ${state}.`,
      `It is ${++ctx.updates} update`,
    ),
})
```

### Options object 3

```ts
const add = declareAction<number>()

const counterAtom = declareAtom(0, {
  id: `counter`,
  ctx: { updates: 0 },
  change: (newState, state) => (store, ctx) =>
    console.log(
      `counterAtom receive new value: ${state}.`,
      `It is ${++ctx.updates} update`,
    ),
}, {
  inc: (inc: AC<void>) => ($, state) => {
    $(inc, () => state++)
    return state
  },
  computer: ($, state) => {
    $(add, (value) => state += value))

    if ($(shouldSyncCounterAtom)) {
      $(globalCounterAtom, (globalCounter) => state = globalCounter)
    }

    return state
  }
})
```
