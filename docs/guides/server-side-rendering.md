# Server Side Rendering

Server rendering is a very useful way to speed up the transfer of content to the user. This makes mobile users happier and more loyal to your resource.

This process consists of 4 stages:

1. Request from browser
2. Building state and render page
3. Send page and state to the browser
4. Hydration your app in browser

![Example project](./server-sider-rendering.assets/requset-response.svg)

If the States are different, there may be problems with the information displayed on the page. This can confuse users and cause unnecessary operations

## Static atom names

You're probably already familiar with declaring dynamic atom names to ensure uniqueness.

```js
declareAtom('greeting', '', () => [])
// name: greeting #1
declareAtom('greeting', '', () => [])
// name: greeting #2
declareAtom('greeting', '', () => [])
// name: greeting #3
```

For this reason, the names on the server and in the browser may differ, because the order of their Declaration may differ.

Not despair :) This moment is thought over by us and for Reatom there is an opportunity to set static names of atoms which will be identical between atoms on the server and in the browser at any time. You can use a single-element tuple to explain a static name.

```js
declareAtom(['greeting'], '', () => [])
// name: greeting
declareAtom(['greeting'], '', () => [])
// name: greeting
declareAtom(['greeting'], '', () => [])
// name: greeting
```

> **WARNING.** Note that you cannot use multiple atoms with the same name in the same store. Try to adhere to the rules of static naming of atoms in the project.

## Example

**Server**

```js
import { declareAction, declareAtom, createStore } from '@reatom/core'

const setText = declareAction()
const greetingAtom = declareAtom(['greeting'], '', on => [
  on(setText, (state, payload) => payload),
])

const store = createStore(greetingAtom)

store.dispatch(setText('Hello Reatom!'))
```

```js
// Serialize your store in html
;`window._INITIAL_DATA = ${JSON.stringify(store.getState())}`
// Result
;`window._INITIAL_DATA = {"greeting": "Hello Reatom!"}`
```

> **NOTE.** NodeJS is single-threaded. Since all requests are handled by one instance of the application, you need to create your own store for each request.

**Browser**

```js
import { declareAction, declareAtom, createStore } from '@reatom/core'

const setText = declareAction()
const greetingAtom = declareAtom(['greeting'], '', on => [
  on(setText, (state, payload) => payload),
])

const store = createStore(greetingAtom, window._INITIAL_DATA)

store.getState(greetingAtom)
// Hello Reatom!
```

---

We hope that from this guide you understand the purpose of static names of atoms. This solution is applicable not only for server side rendering, but also for storing state in [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

## custom function getInitialStoreState

If you don't want use initial data without atom names you can use custom _getInitialStoreState_ function

**Server**

```js
import { declareAction, declareAtom, combine, createStore } from '@reatom/core'
const setTitle = declareAction()
const titleAtom = declareAtom('title', on => [
  on(setTitle, (_, payload) => payload),
])

const setMode = declareAction()
const modeAtom = declareAtom('desktop', on => [
  on(setMode, (_, payload) => payload),
])

const appAtom = combine({
  title: titleAtom,
  mode: modeAtom,
})

const store = createStore(appAtom)
store.dispatch(setTitle('Reatom App'))
store.dispatch(setMode('mobile'))
```

```js
// Serialize your store in html
;`window._INITIAL_DATA = ${JSON.stringify(store.getState(appAtom))}`
// Result
;`window._INITIAL_DATA = {"title":"Reatom App","mode":"mobile"}`
```

**Browser**

```js
import { declareAction, declareAtom, combine, createStore } from '@reatom/core'

function getInitialStoreState(rootAtom, state) {
  const depsShape = getDepsShape(rootAtom)
  if (depsShape) {
    const states = Object.keys(depsShape).map(id =>
      getInitialStoreState(depsShape[id], state[id]),
    )

    return Object.assign({}, ...states)
  }

  return {
    [getTree(rootAtom).id]: state,
  }
}

const setTitle = declareAction()
const titleAtom = declareAtom('title', on => [
  on(setTitle, (_, payload) => payload),
])

const setMode = declareAction()
const modeAtom = declareAtom('desktop', on => [
  on(setMode, (_, payload) => payload),
])

const appAtom = combine({
  title: titleAtom,
  mode: modeAtom,
})

const defaultState = getInitialStoreState(appAtom, window._INITIAL_DATA)

const store = createStore(appAtom, defaultState)

store.getState(appAtom)
// { title: 'Reatom App', mode: 'mobile' }
store.getState(modeAtom)
// mobile
store.getState(titleAtom)
// Reatom App
```
