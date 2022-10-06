Small, performant, powerful and extensible core package for building reactive applications of any size.

## Installation

```sh
npm i @reatom/core@alpha
```

## Usage

```ts
import { createCtx, action, atom } from '@reatom/core'

// create context in the app root
const ctx = createCtx()

// define your base mutable data references
// by passing a primitive initial values
const searchAtom = atom('')
const isSearchingAtom = atom(false)
const goodsAtom = atom<Array<Goods>>([])

// define computed atoms to infer data
// with smart and optimized caching
const tipAtom = atom((ctx) => {
  // read and subscribe by `spy`
  const goodsCount = ctx.spy(goodsAtom).length

  if (goodsCount === 0) {
    // read without subscribing by `get`
    return ctx.get(searchAtom) ? 'Nothing found' : 'Try to search something'
  }
  if (goodsCount === 1) {
    return `We found one treasure`
  }
  return `Found ${goodsCount} goods`
})

// define your actions to handle any IO and work with atoms
const onSearch = action((ctx, event) => {
  // mutate base atoms by passing relative ctx and the new state
  searchAtom(ctx, event.currentTarget.value)
})
const fetchGoods = action((ctx) => {
  const search = ctx.get(searchAtom)
  // [OPTIONAL] get your services from the context
  const api = ctx.get(apiAtom)

  isSearchingAtom(ctx, true)

  // schedule side-effects
  // which will be called after successful execution of all computations
  const promise = ctx.schedule(async () => {
    const goods = await api.getGoods(search)

    // pass a callback to `get` to batch a few updates
    ctx.get(() => {
      isSearchingAtom(ctx, false)
      goodsAtom(ctx, goods)
    })
  })

  // returned promise could be handled in place of the action call
  return promise
})
```

> Do you want to see next [the docs for React adapter](https://reatom.dev/packages/npm-react)?

```ts
// subscribe to your atoms
ctx.subscribe(tipAtom, (tip) => {
  document.getElementById('goods-tip').innerText = tip
})
// handle user interactions by your actions
document.getElementById('search-input').addEventListener('input', (event) => {
  onSearch(ctx, event)
})
// log all things
ctx.subscribe((logs) => {
  console.log(logs)
})
```

Use Reatom ecosystem to made your code clean and readable

```ts
import { onUpdate } from '@reatom/hooks'

onUpdate(searchAtom, fetchGoods)
```

### Action handling

It is better to stay atoms stupid and handle all logic inside action. But sometimes you need to turn direction of your code coupling and make atom depends from an action. And you could do it!

Action is an atom with a temporal state, which array of all passed payloads. This state is clearing after transaction end, if you will try to `get` or `spy` action which wasn't called you will receive an empty array. But if action was called, the array will contain some elements.

```ts
// ~/modules/someFlow
import { newMessage } from '~/modules/ws'

const FLOW_NAME = 'someFlow'

export const someFlowAtom = atom(0)

// you need to subscribe to it to start watching `newMessage`
export const someFlowManagerAtom = atom((ctx) => {
  console.log('example log for `ctx.get(newMessage)`', ctx.get(newMessage))

  ctx.spy(newMessage).forEach((msg) => {
    if (msg.relation === FLOW_NAME) someFlowAtom(ctx, msg)

    console.log('example log for `ctx.spy(newMessage)[N]`', msg)
  })
})

// socket service:
socket.on(
  throttle(150, (msgs) =>
    // batch  updates
    ctx.get(() => {
      msgs.forEach((msg) => newMessage(ctx, msg))
    }),
  ),
)

// someFlowManagerAtom reducer:
// example log for `ctx.get(newMessage)` [1, 2]
// example log for `ctx.spy(newMessage)[N]` 1
// example log for `ctx.spy(newMessage)[N]` 2
```

You need to know one rare tricky thing. If during transaction you will call an action and will read it dependent atom a few time step by step, `ctx.get` will return the whole array of all passed payload, but `ctx.spy` will return array with only new elements, which wasn't handled in this reducer during this transaction. And to made this rare case correct you should spying your dependencies in same way each time, without conditions. In other words, for this case your dependencies list should be static.

## API

### `atom` API

```ts
import { atom } from '@reatom/core'
```

`atom` function is a fabric for an atom - base reactive primitive. Atom don't store it data (state, listeners, dependencies) in itself, it only key to a cache in [ctx](https://reatom.dev/packages/core#ctx-api) (context). You may imagine atom as a prototype for a cache. One of the most powerful Reatom feature is that a cache is immutable, it recreates on each relative update. Cache immutability helps to process [transactions](https://reatom.dev/packages/core#transaction-api) and it super handy for debugging. Don't worry, it is pretty [efficient](https://reatom.dev#performance).

As atom is a key, it should be mapped somewhere to it cache. `ctx` has internal weak map `caches`, which store your data until you have a link to atom. When you subscribe (connect) and unsubscribe (disconnect) from atom the state isn't reseted or deleted, it still stored in cache, which will cleared by GC only after link to the atom disappears from you closures. So, if you define global atom available in a few your modules the state will always persists in memory during application lifetime, neither you subscribed or unsubscribed for the atom, which is useful. If you need to clear state on disconnect or doing other lifetime transformations check the [hooks package](https://reatom.dev/packages/hooks).

If you need to create base mutable atom just pass the initial value to `atom`. Pass the atom name by a second argument (it is optional, but strongly recommended). Resulted atom will be mutable (`mut`) with a callable signature (a function), you could mutate it by passing context and new value or reducer function.

```ts
// create
const countAtom = atom(0, 'count')
// countAtom: AtomMut<number>

// mutate by setter
countAtom(ctx, 10) // 10
// mutate by reducer
countAtom(ctx, (state) => state + 1) // 11
```

You could create a computed derived atoms by passing a function to `atom`. First argument of passed reducer is special kind of `ctx` with `spy` function, which allow you to subscribe to passed atom and receive it fresh state. Second argument is a previous `state` and it optional, you could initiate it by defining a default value.

> TypeScript users note. It is impossible to describe reducer type with optional generic state argument, which is returned from the function. If you use the second `state` argument you should define it type, do not rely on return type.

```ts
const isCountEvenAtom = atom(
  (ctx) => ctx.spy(countAtom) % 2 === 0,
  'isCountEven',
)
// isCountEvenAtom: Atom<number>
```

Reatom allows you to use native language features to describe your conditions, all reactive dependencies recalculating in a real time.

```ts
export const currencyAtom = atom<'us' | 'eu'>('us')
export const rateAtom = atom(1)
export const usCurrencyAtom = atom(0)
export const euCurrencyAtom = atom(0)
export const currencyValueAtom = atom((ctx) => {
  const currency = ctx.spy(currencyAtom)
  // use `if` or `switch` if you want
  const valueAtom = { us: usCurrencyAtom, eu: euCurrencyAtom }[currency]
  return ctx.spy(valueAtom)
})
```

Moreover, you could dynamically create and manage atoms.

```ts
const currencyAtom = atom('us')
const currenciesAtom = atom({ us: atom(0) })
export const currencyValueAtom = atom((ctx) => {
  const currency = ctx.spy(currencyAtom)
  let valueAtom = ctx.spy(currenciesAtom)[currency]

  if (!valueAtom) {
    valueAtom = atom(0)
    currenciesAtom(ctx, (state) => ({
      ...state,
      [currency]: valueAtom,
    }))
  }

  return ctx.spy(valueAtom)
})

// update could look like
ctx.get(currenciesAtom)[ctx.get(currencyAtom)](ctx, newValue)
```

### `atom.pipe` API

Operator map the atom to another thing: `<T extends Atom>(options?: any) => (anAtom: T) => something`

### `action` API

Actions is atom with temporal state, which leaves only during transaction. Action state is array of payloads, it need to handle a few actions call during transaction batch. Action callback could mutate atoms or call other actions, but their dependencies will be notified only after the callback end - it is what batch mean.

Possible usage:

```ts
const increment = action()
// increment: Action<[], void>
const increment = action('increment')
// increment: Action<[], void>

const add = action<number>()
// increment: Action<[number], number>
const add = action<number>('add')
// increment: Action<[number], number>
const add = action<number>((ctx, value: number) => value)
// increment: Action<[number], number>
const add = action<number>((ctx, value: number) => value, 'add')
// increment: Action<[number], number>
```

### `ctx` API

#### `ctx.get` atom API

Get fresh atom state

`get<T>(anAtom: Atom<T>): T`

#### `ctx.get` batch API

Start transaction and batch all updates, same as in action call

`get<T>(cb: () => T): T`

#### `ctx.subscribe` atom API

Subscribe to atom new state

`subscribe<T>(anAtom: Atom<T>, cb: (newState: T) => void): () => void`

#### `ctx.subscribe` log API

Subscribe to transaction end

`subscribe(cb: (logs: Array<AtomCache>, error?: Error) => void): () => void`

### Transaction API

To archive [atomicity](<https://en.wikipedia.org/wiki/Atomicity_(database_systems)>) each update (action call / atom mutation) starts complex batch operation, which trying to optimize your updates and collect them to new immutable [log](https://reatom.dev/packages/core#ctx.subscribe-log-API) of new immutable caches snapshot. If some computation throw an error (like `can't use property of undefined`) whole updates will be canceled, otherwise new caches will be merged to context internal `caches` weak map.
