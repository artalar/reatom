import { performance } from 'perf_hooks'
import * as RA from './reatom'
import * as RE from './redux'

const ITEMS = 100
const logResult: Record<string, number[]> = {}

function repeat(fn: (index: number) => void, times = ITEMS) {
  for (let i = 0; i < times; i++) fn(i)
}
function getId(index) {
  return `id#${index}`
}
function writeLog(name, result) {
  if (!logResult[name]) logResult[name] = []
  logResult[name].push(result)
}
function log(msg, cb) {
  const start = performance.now()
  cb()
  const result = performance.now() - start
  writeLog(msg, result)
}
const suites = [
  {
    type: '[redux]  ',
    initializeStore: RE.initializeStore,
    fetchAddressesDone: RE.fetchAddressesDone,
    subscribe(store, id, logList: number[]) {
      let isFirstCallSkippedCitiesCell = false
      const selectorCitiesCell = RE.createSelectorCitiesCell(id, () => {
        if (isFirstCallSkippedCitiesCell) {
          logList.push(Math.random())
        } else isFirstCallSkippedCitiesCell = true
        return 0
      })
      store.subscribe(() => selectorCitiesCell(store.getState()))

      let isFirstCallSkippedStreetsCell = false
      const selectorStreetsCell = RE.createSelectorStreetsCell(id, () => {
        if (isFirstCallSkippedStreetsCell) {
          logList.push(Math.random())
        } else isFirstCallSkippedStreetsCell = true
        return 0
      })
      store.subscribe(() => selectorStreetsCell(store.getState()))

      let isFirstCallSkippedHousesCell = false
      const selectorHousesCell = RE.createSelectorHousesCell(id, () => {
        if (isFirstCallSkippedHousesCell) {
          logList.push(Math.random())
        } else isFirstCallSkippedHousesCell = true
        return 0
      })
      store.subscribe(() => selectorHousesCell(store.getState()))
    },
    changeHouse: RE.changeHouse,
  },
  {
    type: '[reatom] ',
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
    changeHouse: RA.changeHouse,
  },
] as const

function bench({
  type,
  initializeStore,
  fetchAddressesDone,
  subscribe,
  changeHouse,
}: (typeof suites)[number]) {
  const logList = []
  let store: ReturnType<typeof initializeStore>
  const addresses: RA.Addresses = {
    ids: [],
    cities: {},
    streets: {},
    houses: {},
  }

  repeat(i => {
    const id = getId(i)
    addresses.ids.push(id)
    addresses.cities[id] = `city with id ${i}`
    addresses.streets[id] = `street with id ${i}`
    addresses.houses[id] = 1000 + i
  })

  log(`${type}create store:`, () => (store = initializeStore()))

  log(`${type}dispatch unknown action [1]:`, () =>
    store.dispatch({ type: '...', payload: null }),
  )

  log(`${type}set ${ITEMS} items:`, () =>
    store.dispatch(fetchAddressesDone(addresses)),
  )

  log(`${type}subscribe to ${(ITEMS / 2) * 3} items [1]:`, () =>
    repeat(i => subscribe(store, getId(i), logList), ITEMS / 2),
  )

  log(`${type}dispatch unknown action [2]:`, () =>
    store.dispatch({ type: '...', payload: null }),
  )

  log(`${type}dispatch unknown action [3]:`, () =>
    store.dispatch({ type: '....', payload: null }),
  )

  log(`${type}change one item [1]:`, () =>
    store.dispatch(changeHouse({ id: getId(0), value: 100 })),
  )

  log(`${type}subscribe to ${(ITEMS / 2) * 3} items [2]:`, () =>
    repeat(i => subscribe(store, getId(i + ITEMS / 2), logList), ITEMS / 2),
  )

  log(`${type}dispatch unknown action [4]:`, () =>
    store.dispatch({ type: '.....', payload: null }),
  )

  log(`${type}dispatch unknown action [5]:`, () =>
    store.dispatch({ type: '......', payload: null }),
  )

  log(`${type}change one item [2]:`, () =>
    store.dispatch(changeHouse({ id: getId(0), value: 110 })),
  )

  log(`${type}change step by step ${ITEMS} items:`, () =>
    repeat(i => store.dispatch(changeHouse({ id: getId(i), value: 10 + i }))),
  )

  writeLog(`${type}subscriptions calls:`, logList.length)
}

let times = 100
while (times--) suites.forEach(bench)

function median(values: number[]) {
  if (values.length === 0) return 0

  values = values.map(v => +v)

  values.sort((a, b) => (a - b ? 1 : -1))

  var half = Math.floor(values.length / 2)

  if (values.length % 2) return values[half]

  return (values[half - 1] + values[half]) / 2.0
}

const displayData = Object.entries(logResult).reduce(
  (acc, [testName, testResult]) => (
    (acc[testName] = median(testResult).toFixed(3) + 'ms'), acc
  ),
  {},
)

console.log('\n', 'Average from', ITEMS, 'items;', 100, 'times ')
console.log(displayData)

// Average from 100 items; 100 times 
// { '[redux]  create store:': '0.021ms',
//   '[redux]  dispatch unknown action [1]:': '0.006ms',
//   '[redux]  set 100 items:': '0.004ms',
//   '[redux]  subscribe to 150 items [1]:': '0.242ms',
//   '[redux]  dispatch unknown action [2]:': '0.147ms',
//   '[redux]  dispatch unknown action [3]:': '0.020ms',
//   '[redux]  change one item [1]:': '0.105ms',
//   '[redux]  subscribe to 150 items [2]:': '0.240ms',
//   '[redux]  dispatch unknown action [4]:': '0.173ms',
//   '[redux]  dispatch unknown action [5]:': '0.030ms',
//   '[redux]  change one item [2]:': '0.263ms',
//   '[redux]  change step by step 100 items:': '25.564ms',
//   '[reatom] create store:': '0.065ms',
//   '[reatom] dispatch unknown action [1]:': '0.004ms',
//   '[reatom] set 100 items:': '0.023ms',
//   '[reatom] subscribe to 150 items [1]:': '1.026ms',
//   '[reatom] dispatch unknown action [2]:': '0.742ms',
//   '[reatom] dispatch unknown action [3]:': '0.016ms',
//   '[reatom] change one item [1]:': '0.266ms',
//   '[reatom] subscribe to 150 items [2]:': '0.980ms',
//   '[reatom] dispatch unknown action [4]:': '0.832ms',
//   '[reatom] dispatch unknown action [5]:': '0.036ms',
//   '[reatom] change one item [2]:': '0.424ms',
//   '[reatom] change step by step 100 items:': '41.185ms',
