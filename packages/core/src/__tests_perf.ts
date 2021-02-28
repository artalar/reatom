import { performance } from 'perf_hooks'
import * as effector from 'effector'
import w from 'wonka'
// @ts-expect-error
import { cellx } from 'cellx/dist/cellx.umd.js'
import { $mol_atom2 } from 'mol_atom2_all'
import { Action, Atom, createStore, F } from '../'

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

function mAtom<T>(calc: F<[], T>) {
  const a = new $mol_atom2<T>()
  a.calculate = calc
  return a
}
const mEntry = mAtom(() => 0)
const mA = mAtom(() => mEntry.get())
const mB = mAtom(() => mA.get() + 1)
const mC = mAtom(() => mA.get() + 1)
const mD = mAtom(() => mB.get() + mC.get())
const mE = mAtom(() => mD.get() + 1)
const mF = mAtom(() => mD.get() + mE.get())
const mG = mAtom(() => mD.get() + mE.get())
const mH = mAtom(() => mF.get() + mG.get())
let mRes = 0

start()
async function start() {
  console.log({ res, eRes, wRes, cRes })

  const reatomLogs = []
  const effectorLogs = []
  const wonkaLogs = []
  const cellxLogs = []
  const molLogs = []

  const iterations = 100
  var i = 0
  while (i++ < iterations) {
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
    cRes += cH()
    cellxLogs.push(performance.now() - startCellx)

    const startMol = performance.now()
    mEntry.push(i)
    mRes += mH.get()
    molLogs.push(performance.now() - startMol)
  }

  if (new Set([res, eRes, wRes, cRes, mRes]).size !== 1) {
    console.log(`Results is not equal`)
  }

  console.log(`Median on one call in ms from ${iterations} iterations`)

  console.log(`reatom`, median(reatomLogs).toFixed(3))
  console.log(`effector`, median(effectorLogs).toFixed(3))
  console.log(`wonka`, median(wonkaLogs).toFixed(3))
  console.log(`cellx`, median(cellxLogs).toFixed(3))
  console.log(`mol`, median(molLogs).toFixed(3))
}

function median(values: number[]) {
  if (values.length === 0) return 0

  values = values.map(v => +v)

  values.sort((a, b) => (a - b ? 1 : -1))

  var half = Math.floor(values.length / 2)

  if (values.length % 2) return values[half]

  return (values[half - 1] + values[half]) / 2.0
}
