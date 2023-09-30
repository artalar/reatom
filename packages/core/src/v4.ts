export interface Rec<Values = any> extends Record<string, Values> {}

export interface Fn<Args extends any[] = any[], Return = any> {
  (...a: Args): Return
}

export interface Unsubscribe {
  (): void
}

export interface Frame<T = any> {
  error: null | NonNullable<unknown>
  state: T
  atom: Atom
  cause: Frame
  context: null | Map<Variable, unknown>
  pubs: Array<Frame>
  // `subs.length === 0 && pubs.length !== 0` mean that the atom is dirty
  subs: Array<null | Atom>
}
export interface VariableFrame<T = any> extends Frame<T> {
  context: Map<Variable, unknown>
}

let noop: Fn = () => {}

let STACK: Array<Frame> = []

export let top = () => {
  if (STACK.length === 0) {
    throw new Error('Reatom error: missing async context')
  }
  return STACK[STACK.length - 1]!
}

export interface Atom<State = any> {
  (): State
  __kind: string
}
export interface ValueAtom<State = any> extends Atom<State> {
  (newState?: State): State
}
export interface Action<Params extends any[] = any[], Payload = any>
  extends Atom<Array<{ params: Params; payload: Payload }>> {
  (...a: Params): Payload
}

// https://github.com/tc39/proposal-async-context#proposed-solution
interface AsyncVariableOptions<T = any> {
  name?: string
  defaultValue?: T
}

class Variable<T = any> {
  name: string
  private defaultValue: T
  private runner: Action<[T, Fn]>

  constructor(options: AsyncVariableOptions<T>) {
    this.name = options.name ?? named`variable`
    this.defaultValue = options.defaultValue as T
    this.runner = action((value: T, cb) => {
      ;(top().context ??= new Map()).set(this, value)
      return cb()
    }, this.name)
  }

  closest(frame: Frame): VariableFrame {
    while (!frame.context?.has(this) && frame.cause !== frame) {
      frame = frame.cause
    }
    return frame as VariableFrame
  }

  run<I extends any[], O>(value: T, fn: Fn<I, O>, ...args: I): O {
    return this.runner(value, () => fn(...args))
  }

  get(): T {
    let { context, atom } = this.closest(top())
    atom.name //?

    if (!context.has(this)) {
      context.set(this, this.defaultValue)
    }

    return context.get(this) as T
  }
}

let root = (() => {
  let frame = top()
  // TODO package duplication
  while (frame.atom !== root) frame = frame.cause
  return frame
}) as Atom<Frame<Array<Fn>>>
root.__kind = 'atom'
class Snapshot {
  static createRoot() {
    let frame: VariableFrame<Array<Fn>> = {
      error: null,
      state: [],
      atom: root,
      cause: undefined as unknown as Frame,
      context: new Map(),
      pubs: [],
      subs: [],
    }

    frame.context!.set(
      storeAsyncVariable,
      new WeakMap().set(root, (frame.cause = frame)),
    )

    return new this(frame)
  }

  constructor(public frame = top()) {}

  run<I extends any[], O>(fn: Fn<I, O>, ...args: I): O {
    STACK.push(this.frame)
    try {
      return fn(...args)
    } finally {
      STACK.pop()
    }
  }
}

export let AsyncContext = {
  Variable,
  Snapshot,
}

let copy = (store: StoreWeakMap, frame: Frame, cause: Frame) => {
  frame = {
    error: frame.error,
    state: frame.state,
    atom: frame.atom,
    cause,
    context: frame.context,
    pubs: frame.pubs,
    subs: frame.subs,
  }
  store.set(frame.atom, frame)
  return frame
}

let enqueue = (frame: Frame, store: StoreWeakMap, queue: Array<Fn>) => {
  for (let i = 0; i < frame.subs.length; i++) {
    let sub = frame.subs[i]
    if (!sub) throw new Error('Unexpected empty sub')
    let subFrame = store.get(sub)!

    if (subFrame.subs.length) {
      enqueue(copy(store, subFrame, frame), store, queue)
    } else if (sub.__kind === 'effect') {
      copy(store, subFrame, frame)
      queue.push(sub)
    }
  }
  frame.subs.length = 0
}

// TODO configurable
export let notify = () => {
  for (const fn of root().state.splice(0)) fn()
}

let i = 0
export let named = (name: string | TemplateStringsArray) => `${name}#${++i}`

export let atom: {
  <T>(computed: (() => T) | ((state?: T) => T), name?: string): Atom<T>
  <T>(init: T extends Fn ? never : T, name?: string): ValueAtom<T>
} = <T>(init: {} | ((state?: T) => T), name = named`atom`): Atom<T> => {
  let atom = {
    [name]() {
      let rootFrame = root()
      let topFrame = top()
      let cause = arguments.length ? topFrame : rootFrame
      let store = storeAsyncVariable.get()
      let frame = store.get(atom)
      let linking = topFrame.atom !== root && !arguments.length

      if (!frame) {
        frame = {
          error: null,
          state: typeof init === 'function' ? undefined : init,
          atom,
          cause: topFrame,
          context: null,
          pubs: [],
          subs: [],
        }
        store.set(atom, frame)
      } else if (
        arguments.length ||
        (typeof init === 'function' && frame.pubs.length === 0)
      ) {
        frame = copy(store, frame, cause)
      }

      try {
        STACK.push(rootFrame)
        if (frame.error !== null) throw frame.error

        if (!frame.subs.length || arguments.length) {
          let { error, state, pubs } = frame
          if (typeof init === 'function') {
            if (
              frame.pubs.length === 0 ||
              frame.pubs.some(({ atom, state }) => !Object.is(state, atom()))
            ) {
              STACK[STACK.length - 1] = frame
              frame.pubs = []
              // FIXME
              frame.state = init(state)
              for (let i = 0; i < pubs.length; i++) {
                const pub = pubs[i]!
              }
            }
          }

          if (arguments.length !== 0) {
            frame.state = arguments[0]
          }

          if (
            (!Object.is(state, frame.state) || error != null) &&
            frame.subs.length
          ) {
            let queue = rootFrame.state
            if (queue.length === 0) {
              Promise.resolve().then(bind(notify, rootFrame))
            }
            enqueue(frame, store, queue)
          }
        }
      } catch (error) {
        throw (frame.error = error ?? new Error('Unknown error'))
      } finally {
        if (linking) {
          frame.subs.push(topFrame.atom)
          topFrame.pubs.push(frame)
        }
        STACK.pop()
      }

      return frame.state
    },
  }[name] as Atom<T>

  atom.__kind = 'atom'

  return atom
}

export let action = <Params extends any[] = any[], Payload = any>(
  cb: Fn<Params, Payload>,
  name = named`action`,
): Action<Params, Payload> => {
  let params: undefined | Params
  const action = atom(() => {
    try {
      return cb(...params!)
    } finally {
      params = undefined
      top().pubs.length = 0
    }
  }, name)
  // @ts-expect-error
  return (...a: Params) => action((params = a))
}

export let effect = (fn: Fn, name = named`effect`): Unsubscribe => {
  let effect = atom(() => {
    fn()
  }, name)
  effect.__kind = 'effect'
  effect()
  return () => {
    // FIXME
    effect
  }
}

interface StoreWeakMap extends WeakMap<Atom, Frame> {}

let storeAsyncVariable = new AsyncContext.Variable<StoreWeakMap>({
  name: 'store',
})

export let read = <T>(cb: Fn<[], T>): T =>
  new AsyncContext.Snapshot(root()).run(cb)

export let bind = <T extends Promise<any> | Fn>(
  target: T,
  frame = top(),
): T => {
  let snapshot = new AsyncContext.Snapshot(frame)

  if (typeof target === 'function') {
    return ((...a: any[]) => snapshot.run(target, ...a)) as T
  }

  return new Promise(async (resolve, reject) => {
    let seal
    try {
      let value = await target
      seal = () => resolve(value)
    } catch (error) {
      seal = () => reject(error)
    }
    Promise.resolve().then(() => {
      STACK.push(snapshot.frame)
    })
    seal()
    Promise.resolve().then(() => {
      // TODO next microtick
      snapshot.run(noop)
      STACK.pop()
    })
  }) as T
}

// DEFAULT
STACK.push(AsyncContext.Snapshot.createRoot().frame)

/* --- TESTS --- */

const sleep = (ms = 0) => new Promise((res) => setTimeout(res, ms))

let getStackTrace = (acc = '', frame = top()): string => {
  return frame.atom === root
    ? acc
    : getStackTrace(`${acc} <-- ${frame.atom.name}`, frame.cause)
}

class ProxyStoreWeakMap extends WeakMap implements StoreWeakMap {
  constructor(private store: StoreWeakMap) {
    super()
  }
  get(key: any) {
    return super.has(key) ? super.get(key) : this.store.get(key)
  }
  set(key: any, value: any) {
    if (this.store.has(key)) {
      this.store.set(key, value)
    } else {
      super.set(key, value)
    }
    return this
  }
  has(key: any) {
    return super.has(key) || this.store.has(key)
  }
}

export let nest = <T>(fn: Fn<any[], T>): T => {
  return atom(
    () => {
      top().context = new Map([
        [storeAsyncVariable, new ProxyStoreWeakMap(storeAsyncVariable.get())],
      ])
      return fn()
    },
    named`nest`,
  )()
}

let a0 = atom(0, 'a0')
let a1 = atom(() => a0(), 'a1')
let a2 = atom(() => a1() + 1, 'a2')
let a3 = atom(() => a1() + 1, 'a3')
let a4 = atom(() => a2() + a3(), 'a4')
let a5 = atom(() => a4() + 1, 'a5')
let a6 = atom(() => a4() + a5(), 'a6')
let a7 = atom(() => a4() + a5(), 'a7')
let a8 = atom(() => a6() + a7(), 'a8')

effect(async () => {
  const v = a8()
  await bind(sleep())
  if (v < 100) a0(v)
})
effect(() => {
  console.log(a0(), getStackTrace())
})

let global = atom(0, 'global')
let local = atom(0, 'local')
let data = atom(async () => {
  await bind(sleep())
  return `${global()}.${local()}`
}, 'data')

global(1)
nest(() => {
  global(10)
  local(1)
  data() //?
})
nest(() => {
  global(20)
  local(2)
  data() //?
})
