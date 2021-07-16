import { performance } from 'perf_hooks'
import * as effector from 'effector'
import w from 'wonka'
import { cellx } from 'cellx'
import { $mol_atom2 } from 'mol_atom2_all'
import {
  Atom,
  Cache,
  CacheTemplate,
  declareAction,
  declareAtom,
  Fn,
  Transaction,
} from '@reatom/core'

function map<T, Dep>(
  depAtom: Atom<Dep>,
  cb: Fn<[depState: Dep], T>,
  id: string = ``,
): Atom<T> {
  const atom = Object.assign(
    (t: Transaction, cache?: CacheTemplate<T>): Cache<T> => {
      const depPatch = t.process(depAtom)
      const dep =
        cache?.deps.length === 1 ? cache.deps[0] : { atom, cache: null }

      if (dep.cache !== depPatch) {
        cache = {
          deps: [{ atom: depAtom, cache: depPatch }],
          ctx: {},
          state: Object.is(dep.cache?.state, depPatch.state)
            ? cache!.state
            : cb(depPatch.state /* , cache.state */),
          toSnapshot() {
            return this.state
          },
          types: depPatch.types,
        }
      }

      return cache as Cache<T>
    },
    {
      id,
    },
  )

  return atom
}

async function start(iterations = 1_000) {
  // const reatomV1 = await import('https://cdn.skypack.dev/@reatom/core')

  const w_combine = <A, B>(
    sourceA: w.Source<A>,
    sourceB: w.Source<B>,
  ): w.Source<[A, B]> => {
    const source = w.combine(sourceA, sourceB)
    // return source
    return w.pipe(source, w.sample(source))
  }

  const entry = declareAction<number>()
  const a = declareAtom(
    {},
    ($, state = 0) => {
      // $(entry.handle(v => (state = v % 2 ? state : v + 1)))
      $(entry, (v) => (state = v))
      return state
    },
    {},
  )
  const b = map(a, (v) => v + 1)
  const c = map(a, (v) => v + 1)
  const d = declareAtom({}, ($) => $(b) + $(c))
  const e = map(d, (v) => v + 1)
  const f = declareAtom({}, ($) => $(d) + $(e))
  const g = declareAtom({}, ($) => $(d) + $(e))
  const h = declareAtom({}, ($) => $(f) + $(g))
  let res = 0
  h.subscribe((v) => {
    res += v
  })
  res = 0

  // const rEntry = reatomV1.declareAction()
  // const rA = reatomV1.declareAtom(0, on => [on(rEntry, v => v)])
  // const rB = reatomV1.map(rA, a => a + 1)
  // const rC = reatomV1.map(rA, a => a + 1)
  // const rD = reatomV1.map(reatomV1.combine([rB, rC]), ([b, c]) => b + c)
  // const rE = reatomV1.map(rD, d => d + 1)
  // const rF = reatomV1.map(reatomV1.combine([rD, rE]), ([d, e]) => d + e)
  // const rG = reatomV1.map(reatomV1.combine([rD, rE]), ([d, e]) => d + e)
  // const rH = reatomV1.map(reatomV1.combine([rF, rG]), ([h1, h2]) => h1 + h2)
  // const rStore = reatomV1.createStore()
  // let rRes = 0
  // rStore.subscribe(rH, v => {
  //   rRes += v
  // })
  // rRes = 0

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

  const reatomLogs = []
  const reatomV1Logs = []
  const effectorLogs = []
  const wonkaLogs = []
  const cellxLogs = []
  const molLogs = []

  var i = 0
  while (i++ < iterations) {
    const startReatom = performance.now()
    entry.dispatch(i)
    reatomLogs.push(performance.now() - startReatom)

    // const startReatomV1 = performance.now()
    // rStore.dispatch(rEntry(i))
    // reatomV1Logs.push(performance.now() - startReatomV1)

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

  if (new Set([res, /* rRes, */ eRes, wRes, cRes, mRes]).size !== 1) {
    console.log(`ERROR!`)
    console.error(`Results is not equal`)
  }

  console.log(`reatom`)
  console.log(log(reatomLogs) /*  */)
  console.log(`effector`)
  console.log(log(effectorLogs) /**/)
  console.log(`mol`)
  console.log(log(molLogs) /*     */)
  console.log(`cellx`)
  console.log(log(cellxLogs) /*   */)
  console.log(`wonka`)
  console.log(log(wonkaLogs) /*   */)
}
start(100)

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

  values //?

  return values[limit].toFixed(3)
}

function max(values: Array<number>) {
  if (values.length === 0) return 0

  values = values.map((v) => +v)

  values.sort((a, b) => (a - b < 0 ? -1 : 1))

  const limit = values.length - 1 - Math.floor(values.length / 20)

  return values[limit].toFixed(3)
}
