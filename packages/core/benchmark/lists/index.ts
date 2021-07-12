import { performance } from 'perf_hooks'
import * as RA from './reatom'
import * as RE from './redux'

const ITEMS = 200
const logResult: Record<string, Record<string, number[]>> = {}

function noop() {}
function repeat(fn: (index: number) => void, times = ITEMS) {
  for (let i = 0; i < times; i++) fn(i)
}
function getId(index) {
  return `id#${index}`
}
function writeLog({ type, name, result }) {
  if (!logResult[name]) logResult[name] = {}
  if (!logResult[name][type]) logResult[name][type] = []
  logResult[name][type].push(result)
}
function log(type, name, cb) {
  const start = performance.now()
  cb()
  const result = performance.now() - start
  writeLog({ type, name, result })
}
const suites = [
  {
    type: 'redux',
    initializeStore: RE.initializeStore,
    fetchAddressesDone: RE.fetchAddressesDone,
    subscribe(store, id, logList: number[]) {
      const state = store.getState()
      let citiesCellCallback = noop
      const selectorCitiesCell = RE.createSelectorCitiesCell(id, () =>
        citiesCellCallback(),
      )
      store.subscribe(() => selectorCitiesCell(store.getState()))
      // fill the cache
      selectorCitiesCell(state)
      citiesCellCallback = () => logList.push(Math.random())

      let streetsCellCallback = noop
      const selectorStreetsCell = RE.createSelectorStreetsCell(id, () =>
        streetsCellCallback(),
      )
      store.subscribe(() => selectorStreetsCell(store.getState()))
      // fill the cache
      selectorStreetsCell(state)
      streetsCellCallback = () => logList.push(Math.random())

      let housesCellCallback = noop
      const selectorHousesCell = RE.createSelectorHousesCell(id, () =>
        housesCellCallback(),
      )
      store.subscribe(() => selectorHousesCell(store.getState()))
      // fill the cache
      selectorHousesCell(state)
      housesCellCallback = () => logList.push(Math.random())
    },
    subscribeToInput(store, logList: number[]) {
      let inputCallback = noop
      const selectorInput = RE.createSelectorInput(() => inputCallback())
      store.subscribe(() => selectorInput(store.getState()))
      // fill the cache
      selectorInput(store.getState())
      inputCallback = () => logList.push(Math.random())
    },
    changeHouse: RE.changeHouse,
    changeInput: RE.changeInput,
  },
  {
    type: 'reatom',
    initializeStore: RA.initializeStore,
    fetchAddressesDone: RA.fetchAddressesDone,
    subscribe(store, id, logList: number[]) {
      store.subscribe(RA.declareCitiesCell(id), () =>
        logList.push(Math.random()),
      )

      store.subscribe(RA.declareStreetsCell(id), () =>
        logList.push(Math.random()),
      )

      store.subscribe(RA.declareHousesCell(id), () =>
        logList.push(Math.random()),
      )
    },
    subscribeToInput(store, logList: number[]) {
      store.subscribe(RA.Input, () => logList.push(Math.random()))
    },
    changeHouse: RA.changeHouse,
    changeInput: RA.changeInput,
  },
] as const

function bench({
  type,
  initializeStore,
  fetchAddressesDone,
  subscribe,
  subscribeToInput,
  changeHouse,
  changeInput,
}: typeof suites[number]) {
  const logList = []
  let store: ReturnType<typeof initializeStore>
  const addresses: RA.Addresses = {
    ids: [],
    cities: {},
    streets: {},
    houses: {},
  }

  repeat((i) => {
    const id = getId(i)
    addresses.ids.push(id)
    addresses.cities[id] = `city with id ${i}`
    addresses.streets[id] = `street with id ${i}`
    addresses.houses[id] = 1000 + i
  })

  log(type, `create store`, () => (store = initializeStore()))

  log(type, `dispatch unknown action [1]`, () =>
    store.dispatch({ type: '...', payload: null }),
  )

  log(type, `set ${ITEMS} items`, () =>
    store.dispatch(fetchAddressesDone(addresses)),
  )

  log(type, `subscribe to ${(ITEMS / 2) * 3} items [1]`, () =>
    repeat((i) => subscribe(store, getId(i), logList), ITEMS / 2),
  )

  log(type, `subscribe to input`, () => subscribeToInput(store, logList))

  log(type, `dispatch unknown action [2]`, () =>
    store.dispatch({ type: '...', payload: null }),
  )

  log(type, `dispatch unknown action [3]`, () =>
    store.dispatch({ type: '....', payload: null }),
  )

  log(type, `change one item [1]`, () =>
    store.dispatch(changeHouse({ id: getId(0), value: 100 })),
  )

  log(type, `subscribe to ${(ITEMS / 2) * 3} items [2]`, () =>
    repeat((i) => subscribe(store, getId(i + ITEMS / 2), logList), ITEMS / 2),
  )

  log(type, `dispatch unknown action [4]`, () =>
    store.dispatch({ type: '.....', payload: null }),
  )

  log(type, `dispatch unknown action [5]`, () =>
    store.dispatch({ type: '......', payload: null }),
  )

  log(type, `change one item [2]`, () =>
    store.dispatch(changeHouse({ id: getId(0), value: 110 })),
  )

  // here "input" is independent part of store with minimum dependencies
  log(type, `change input`, () => store.dispatch(changeInput('input')))

  log(type, `change step by step ${ITEMS} items`, () =>
    repeat((i) => store.dispatch(changeHouse({ id: getId(i), value: 10 + i }))),
  )

  writeLog({ type, name: 'subscriptions calls', result: logList.length })
}

const times = 400
let i = 0
while (++i < times) suites.forEach(bench)

function median(values: number[]) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b ? 1 : -1))

  const half = Math.floor(values.length / 2)

  if (values.length % 2) return values[half]

  return (values[half - 1] + values[half]) / 2.0
}

function medianTitle(type, results) {
  return `${type}: ${median(results[type]).toFixed(3)}ms`
}

const displayData = Object.entries(logResult)
  .map(
    ([name, typesResults]) =>
      // eslint-disable-next-line prefer-template
      `${name}\n` +
      medianTitle('redux', typesResults) +
      '\n' +
      medianTitle('reatom', typesResults),
  )
  .join('\n\n')

export const displayResult = () => {
  // eslint-disable-next-line no-console
  console.log('\n', 'Average from', ITEMS, 'items;', times, 'times \n')
  // eslint-disable-next-line no-console
  console.log(displayData)
}

// Build "core" to build:
//        1854 B: index.js.gz
//        1695 B: index.js.br
//        1856 B: index.es.js.gz
//        1705 B: index.es.js.br
//        1907 B: index.umd.js.gz
//        1752 B: index.umd.js.br

// Average from 200 items; 400 times

// create store
// redux: 0.020ms
// reatom: 0.054ms

// dispatch unknown action [1]
// redux: 0.004ms
// reatom: 0.001ms

// set 200 items
// redux: 0.003ms
// reatom: 0.010ms

// subscribe to 300 items [1]
// redux: 0.727ms
// reatom: 2.847ms

// subscribe to input
// redux: 0.006ms
// reatom: 0.002ms

// dispatch unknown action [2]
// redux: 0.046ms
// reatom: 0.001ms

// dispatch unknown action [3]
// redux: 0.023ms
// reatom: 0.000ms

// change one item [1]
// redux: 0.274ms
// reatom: 0.195ms

// subscribe to 300 items [2]
// redux: 0.680ms
// reatom: 2.495ms

// dispatch unknown action [4]
// redux: 0.077ms
// reatom: 0.001ms

// dispatch unknown action [5]
// redux: 0.042ms
// reatom: 0.000ms

// change one item [2]
// redux: 0.463ms
// reatom: 0.261ms

// change input
// redux: 0.338ms
// reatom: 0.007ms

// change step by step 200 items
// redux: 118.191ms
// reatom: 45.304ms
