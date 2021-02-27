import { performance } from 'perf_hooks'
import * as effector from 'effector'
import w from 'wonka'
// @ts-expect-error
import { cellx } from 'cellx/dist/cellx.umd.js'
import { Action, Atom, createStore } from '../build'

const w_combine = <A, B>(
  sourceA: w.Source<A>,
  sourceB: w.Source<B>,
): w.Source<[A, B]> => {
  const source = w.combine(sourceA, sourceB)
  // return source
  return w.pipe(source, w.sample(source))
}

const entry = Action<number>()
const a = Atom(($, state: number = 0) => {
  // $(entry, v => (state = v % 2 ? state : v + 1))
  $(entry, v => (state = v))
  return state
})
const b = Atom($ => $(a) + 1)
const c = Atom($ => $(a) + 1)
const d = Atom($ => $(b) + $(c))
const e = Atom($ => $(d) + 1)
const f = Atom($ => $(d) + $(e))
const g = Atom($ => $(d) + $(e))
const h = Atom($ => $(f) + $(g))
const store = createStore()
let res = 0
store.subscribe(h, v => {
  res += v
})
res = 0

const eEntry = effector.createEvent<number>()
const eA = effector
  .createStore(0)
  // .on(eEntry, (state, v) => (v % 2 ? state : v + 1))
  .on(eEntry, (state, v) => v)
const eB = eA.map(a => a + 1)
const eC = eA.map(a => a + 1)
const eD = effector.combine(eB, eC, (b, c) => b + c)
const eE = eD.map(d => d + 1)
const eF = effector.combine(eD, eE, (d, e) => d + e)
const eG = effector.combine(eD, eE, (d, e) => d + e)
const eH = effector.combine(eF, eG, (h1, h2) => h1 + h2)
let eRes = 0
eH.subscribe(v => {
  eRes += v
})
eRes = 0

const wEntry = w.makeSubject<number>()
const wA = w.pipe(
  wEntry.source,
  w.map(v => v),
)
const wB = w.pipe(
  wA,
  w.map(v => v + 1),
)
const wC = w.pipe(
  wA,
  w.map(v => v + 1),
)
const wD = w.pipe(
  w_combine(wB, wC),
  w.map(([b, c]) => b + c),
)
const wE = w.pipe(
  wD,
  w.map(v => v + 1),
)
const wF = w.pipe(
  w_combine(wD, wE),
  w.map(([d, e]) => d + e),
)
const wG = w.pipe(
  w_combine(wD, wE),
  w.map(([d, e]) => d + e),
)
const wH = w.pipe(
  w_combine(wF, wG),
  w.map(([h1, h2]) => h1 + h2),
)
let wRes = 0
w.pipe(
  wH,
  w.subscribe(v => {
    wRes += v
  }),
)
wRes = 0

const cEntry = cellx(0)
const cA = cellx(() => cEntry())
const cB = cellx(() => cA() + 1)
const cC = cellx(() => cA() + 1)
const cD = cellx(() => cB() + cC())
const cE = cellx(() => cD() + 1)
const cF = cellx(() => cD() + cE())
const cG = cellx(() => cD() + cE())
const cH = cellx(() => cF() + cG())
let cRes = 0
cH.subscribe(() => {
  cRes += cH()
})
cRes = 0

start()
async function start() {
  console.log({ res, eRes, wRes, cRes })

  const reatomLogs = []
  const effectorLogs = []
  const wonkaLogs = []
  const cellxLogs = []

  var i = 0
  while (i++ < 1000) {
    const startReatom = performance.now()
    store.dispatch(entry(i))
    reatomLogs.push(performance.now() - startReatom)

    const startEffector = performance.now()
    eEntry(i)
    effectorLogs.push(performance.now() - startEffector)

    const startWonka = performance.now()
    wEntry.next(i)
    wonkaLogs.push(performance.now() - startWonka)

    const startCellx = performance.now()
    cEntry(i)
    cH()
    cellxLogs.push(performance.now() - startCellx)
  }

  console.log({ res, eRes, wRes, cRes })
  console.log('reatom', median(reatomLogs).toFixed(3))
  console.log('effector', median(effectorLogs).toFixed(3))
  console.log('wonka', median(wonkaLogs).toFixed(3))
  console.log('cellx', median(cellxLogs).toFixed(3))
}
function median(values: number[]) {
  if (values.length === 0) return 0

  values = values.map(v => +v)

  values.sort((a, b) => (a - b ? 1 : -1))

  var half = Math.floor(values.length / 2)

  if (values.length % 2) return values[half]

  return (values[half - 1] + values[half]) / 2.0
}
