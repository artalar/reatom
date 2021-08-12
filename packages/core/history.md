# History of API / architecture choices

## Atom options

Main problems

- Execution order
- Type inference
- Calculation sharing

### Options builder

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

### Options declarative properties

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

### Options function properties

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

### Options method properties

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

### Options single function

```ts
const add = declareAction<number>()

const counterAtom = declareAtom({ inc: () => null }, ($, state = 0) => {
  const oldState = state

  $((store, ctx) =>
    console.log(
      `counterAtom receive new value: ${state}.`,
      `It is ${(ctx.updates = (ctx.updates ?? 0) + 1)} update`,
    ),
  )

  $({ inc: () => state++ })

  $(add, (value) => (state += value))

  if ($(shouldSyncCounterAtom)) {
    $(globalCounterAtom, (globalCounter) => (state = globalCounter))
  }

  return state
})
```

### Options static dependencies

```ts
// decline outer actionCreators support

const counterAtom = declareAtom(
  { shouldSyncCounterAtom, globalCounterAtom, inc: () => null },
  ({ get, onAction, onChange, schedule }, state = 0) => {
    const oldState = state

    schedule((dispatch, ctx) =>
      console.log(
        `counterAtom receive new value: ${state}.`,
        `It is ${(ctx.updates = (ctx.updates ?? 0) + 1)} update`,
      ),
    )

    onAction(`inc`, () => state++)

    if (get(`shouldSyncCounterAtom`)) {
      onChange(`globalCounterAtom`, (globalCounter) => (state = globalCounter))
    }

    return state
  },
)
```
