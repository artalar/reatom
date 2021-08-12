import { performance } from 'perf_hooks'
import * as effector from 'effector'
import w from 'wonka'
import { cellx } from 'cellx'
import { $mol_atom2 } from 'mol_atom2_all'
import { createAtom, defaultStore, Fn } from '@reatom/core'
import { combine, map } from '@reatom/core/experiments'

async function start(iterations = 1_000) {
  const w_combine = <A, B>(
    sourceA: w.Source<A>,
    sourceB: w.Source<B>,
  ): w.Source<[A, B]> => {
    const source = w.combine(sourceA, sourceB)
    // return source
    return w.pipe(source, w.sample(source))
  }

  const a = createAtom(
    { entry: (payload: number) => payload },
    ({ onAction }, state = 0) => {
      // onAction(`entry`, (v) => (state = v % 2 ? state : v + 1))
      onAction(`entry`, (v) => (state = v))
      return state
    },
    {},
  )

  const b = createAtom({ a }, ({ get }) => get(`a`) + 1)
  const c = createAtom({ a }, ({ get }) => get(`a`) + 1)
  const d = createAtom({ b, c }, ({ get }) => get(`b`) + get(`c`))
  const e = createAtom({ d }, ({ get }) => get(`d`) + 1)
  const f = createAtom({ d, e }, ({ get }) => get(`d`) + get(`e`))
  const g = createAtom({ d, e }, ({ get }) => get(`d`) + get(`e`))

  const h = createAtom({ f, g }, ({ get }) => get(`f`) + get(`g`))

  let res = 0
  defaultStore.subscribe(h, (v) => {
    res += v
  })
  res = 0

  const aV1 = createAtom(
    { entry: (payload: number) => payload },
    ({ onAction }, state = 0) => {
      // onAction(`entry`, (v) => (state = v % 2 ? state : v + 1))
      onAction(`entry`, (v) => (state = v))
      return state
    },
    {},
  )

  const bV1 = map(aV1, (v) => v + 1)
  const cV1 = map(aV1, (v) => v + 1)
  const dV1 = combine([bV1, cV1], ([b, c]) => b + c)
  const eV1 = map(dV1, (v) => v + 1)
  const fV1 = combine([dV1, eV1], ([d, e]) => d + e)
  const gV1 = combine([dV1, eV1], ([d, e]) => d + e)
  const hV1 = combine([fV1, gV1], ([f, g]) => f + g)

  let resV1 = 0
  defaultStore.subscribe(hV1, (v) => {
    resV1 += v
  })
  resV1 = 0

  const eEntry = effector.createEvent<number>()
  const eA = effector
    .createStore(0)
    // .on(eEntry, (state, v) => (v % 2 ? state : v + 1))
    .on(eEntry, (state, v) => v)
  const eB = eA.map((a) => a + 1)
  const eC = eA.map((a) => a + 1)
  const eD = effector.combine(eB, eC, (b, c) => b + c)
  const eE = eD.map((d) => d + 1)
  const eF = effector.combine(eD, eE, (d, e) => d + e)
  const eG = effector.combine(eD, eE, (d, e) => d + e)
  const eH = effector.combine(eF, eG, (h1, h2) => h1 + h2)
  let eRes = 0
  eH.subscribe((v) => {
    eRes += v
  })
  eRes = 0

  const wEntry = w.makeSubject<number>()
  const wA = w.pipe(
    wEntry.source,
    w.map((v) => v),
  )
  const wB = w.pipe(
    wA,
    w.map((v) => v + 1),
  )
  const wC = w.pipe(
    wA,
    w.map((v) => v + 1),
  )
  const wD = w.pipe(
    w_combine(wB, wC),
    w.map(([b, c]) => b + c),
  )
  const wE = w.pipe(
    wD,
    w.map((v) => v + 1),
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
    w.subscribe((v) => {
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

  function mAtom<T>(calc: Fn<[], T>) {
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

  const reatomLogs = new Array<number>()
  const reatomV1Logs = new Array<number>()
  const effectorLogs = new Array<number>()
  const wonkaLogs = new Array<number>()
  const cellxLogs = new Array<number>()
  const molLogs = new Array<number>()

  var i = 0
  while (i++ < iterations) {
    const startReatom = performance.now()
    defaultStore.dispatch(a.entry(i))
    reatomLogs.push(performance.now() - startReatom)

    const startReatomV1 = performance.now()
    defaultStore.dispatch(aV1.entry(i))
    reatomV1Logs.push(performance.now() - startReatomV1)

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

  console.log(`Median on one call in ms from ${iterations} iterations`)

  if (new Set([res, resV1, /* rRes, */ eRes, wRes, cRes, mRes]).size !== 1) {
    ;({ res, res1: resV1, /* rRes, */ eRes, wRes, cRes, mRes }) //?
    console.log(`ERROR!`)
    console.error(`Results is not equal`)
  }

  console.log(`reatom`)
  console.log(log(reatomLogs) /*  */)
  console.log(`reatomV1`)
  console.log(log(reatomV1Logs) /*  */)
  console.log(`effector`)
  console.log(log(effectorLogs) /**/)
  console.log(`mol`)
  console.log(log(molLogs) /*     */)
  console.log(`cellx`)
  console.log(log(cellxLogs) /*   */)
  console.log(`wonka`)
  console.log(log(wonkaLogs) /*   */)
}
// start(100)
start(1000)
// start(10000)
// start(100000)

function log(values: Array<number>) {
  return {
    min: min(values),
    med: med(values),
    max: max(values),
  }
}

function med(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? 1 : -1))

  var half = Math.floor(values.length / 2)

  if (values.length % 2) return values[half]

  return ((values[half - 1] + values[half]) / 2.0).toFixed(3)
}

function min(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? -1 : 1))

  const limit = Math.floor(values.length / 20)

  return values[limit].toFixed(3)
}

function max(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? -1 : 1))

  const limit = values.length - 1 - Math.floor(values.length / 20)

  return values[limit].toFixed(3)
}
