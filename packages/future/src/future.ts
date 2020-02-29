import * as effector from 'effector'

/* -------- */
/* - TEST - */
/* -------- */

// declare function assert(condition: boolean, description?: string): asserts condition
function assert(condition: boolean, description = 'Assert error') {
  if (condition === false) throw new Error(description)
}
function isObject(thing: any): thing is Collection<unknown> {
  return typeof thing === 'object' && thing !== null
}

declare function isEqual<A, B extends A>(a: A, b: B): a is B
declare function isEqual<B, A extends B>(a: A, b: B): b is A
function isEqual(a: any, b: any): any {
  return (
    Object.is(a, b) ||
    (isObject(a) &&
      isObject(b) &&
      Object.keys(a).length === Object.keys(b).length &&
      Object.entries(a).every(([k, v]) => isEqual(v, b[k])))
  )
}

declare function createTrackedFn(): FnAny & { _calls: unknown[][] }
declare function createTrackedFn<T extends FnAny>(
  executor: T,
): T & { _calls: unknown[][] }
function createTrackedFn(executor = (v => v) as FnAny): any {
  const _calls: unknown[][] = []

  return assign(
    function fn(...a: any[]) {
      const result = executor(...a)
      _calls.push(a)
      return result
    },
    { _calls },
  )
}

;(async () => {
  const f0Map = createTrackedFn((v: number) => v + 1)
  const f1Map = createTrackedFn(v => v + 1)
  const f2Map = createTrackedFn(([_0, _1]) => ({ _0, _1 }))

  const f0 = futureOf(f0Map)
  const f1 = futureMap(f0, f1Map)
  const f2 = futureCombine([f0, f1], f2Map)

  const track = createTrackedFn()
  const uns = f2.subscribe(track)

  const result = f2([1, 2])
  const expected = { _0: 2, _1: 3 }

  assert(isEqual(result, expected))

  assert(f0Map._calls.length === 1)
  assert(f1Map._calls.length === 1)
  assert(f2Map._calls.length === 1)

  assert(track._calls.length === 1 && isEqual(track._calls[0][0], expected))

  uns()
  f2([2, 3])
  assert(track._calls.length === 1)
})()
;(async () => {
  const track = createTrackedFn((v: string) => v)

  const f3 = futureOf((v: number) => Promise.resolve(`_${v}`)).chain(track)
  const result = await f3(42)
  const expected = '_42'

  assert(isEqual(result, expected))
  assert(isEqual(track._calls[0][0], expected))
})()
;(async () => {
  const a1 = atomOf(0)
  const a2 = atomOf('0', {
    reducers: [
      a1.reduce((a, b) => {
        return a + b
      }),
    ],
  })

  a2.subscribe(v => {
    v //?
  })

  a1(1) //?
  a1(1) //?
})()
;(async () => {
  const atom = atomOf(0, {
    reducers: [atomOf('').reduce((state, payload) => state)],
    actions: {
      update(state, payload: number) {
        return payload
      },
    },
  })

  atom.subscribe(v => {
    v //?
  })

  atom.actions.update(1) //?
  atom.actions.update(2) //?
})()

// const myAtom = atom({
//   name: 'myAtom', // or 'key' (optional)
//   initState: '...',
//   domain: '...', // (optional)
//   reducers: [
//     doSome.reduce((state, payload) => state),
//     dataAtom.reduce((state, data) => state),
//   ],
//   actions: {
//     update: (state, payload) => payload
//   }
// })

// myAtom.update(42)
// // { type: 'update "myAtom [1]"', payload: 42 }

/* --------- */
/* PERF TEST */
/* --------- */
;(() => {
  return
  const entry = futureOf((v: number = 0) => v) //1
  const a = atomOf(0, { reducers: [entry.reduce(s => s + 1)] }) //2
  const b = futureMap(a, a => a + 1) //3
  const c = futureMap(a, a => a + 1) //4
  const d = futureCombine([b, c], ([b, c]) => b + c) //5
  const e = futureMap(d, d => d + 1) //6
  const f = futureMap(d, d => d + 1) //7
  const g = futureCombine([e, f], ([e, f]) => e + f) //8
  const h1 = futureCombine([d, e, f, g], ([d, e, f, g]) => d + e + f + g) //9
  const h2 = futureCombine([d, e, f, g], ([d, e, f, g]) => d + e + f + g) //10
  const h = futureCombine([h1, h2], ([h1, h2]) => h1 + h2) //11
  let res = 0
  h.subscribe(v => {
    res += v
  })
  res = 0
  entry()

  const eEntry = effector.createEvent()
  const eA = effector.createStore(0).on(eEntry, s => s + 1)
  const eB = eA.map(a => a + 1)
  const eC = eA.map(a => a + 1)
  const eD = effector.combine(eB, eC, (b, c) => b + c)
  const eE = eD.map(d => d + 1)
  const eF = eD.map(d => d + 1)
  const eG = effector.combine(eE, eF, (e, f) => e + f)
  const eH1 = effector.combine(eD, eE, eF, eG, (d, e, f, g) => d + e + f + g)
  const eH2 = effector.combine(eD, eE, eF, eG, (d, e, f, g) => d + e + f + g)
  const eH = effector.combine(eH1, eH2, (h1, h2) => h1 + h2)
  let eRes = 0
  eH.subscribe(v => {
    eRes += v
  })
  eRes = 0
  eEntry()

  console.log({ res, eRes })

  var i = 1000
  while (i--) {
    /* REATOM   */ entry() //?.
    /* EFFECTOR */ eEntry() //?.

    // if (!(i % 50)) {
    //   const future = futureCombine([e, f], ([e, f]) => e + f) //?.
    //   future.subscribe(v => (res += v))                       //?.
    //   future.subscribe(v => (res += v))                       //?.
    //   future.subscribe(v => (res += v))                       //?.
    //   future.subscribe(v => (res += v))                       //?.
    //   const store = effector.combine(eE, eF, (e, f) => e + f) //?.
    //   store.subscribe(v => (eRes += v))                       //?.
    //   store.subscribe(v => (eRes += v))                       //?.
    //   store.subscribe(v => (eRes += v))                       //?.
    //   store.subscribe(v => (eRes += v))                       //?.
    // }
  }

  console.log({ res, eRes })
})()
