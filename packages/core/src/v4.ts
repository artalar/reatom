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
  subs: Array<Atom>
}
export interface RootFrame extends Frame {
  context: Map<Variable, unknown>
}

let noop: Fn = () => {}

let TOP: null | Frame = null

export let top = () => {
  if (!TOP) throw new Error('Reatom error: missing async context')
  return TOP
}

export interface Atom<State = any> {
  (newState?: State): State
  reatom: string
}
export interface ComputedAtom<State = any> extends Atom<State> {
  (): State
}

interface AsyncVariableOptions<T = any> {
  name: string
  defaultValue: T
}

class Variable<T = any> {
  name: string
  defaultValue: T
  // TODO use action
  private transport: Fn
  private atom: Atom

  constructor(options: AsyncVariableOptions<T>) {
    this.name = options.name
    this.defaultValue = options.defaultValue
    this.transport = noop
    this.atom = reatom(() => void this.transport(), this.name)
  }

  closest(frame: Frame): RootFrame {
    while (!frame.context?.has(this) && frame.cause !== frame) {
      frame = frame.cause
    }
    return frame as RootFrame
  }

  run<I extends any[], O>(value: T, fn: Fn<I, O>, ...args: I): O {
    let result: O
    this.transport = () => {
      this.transport = noop
      ;(TOP!.context ??= new Map()).set(this, value)
      result = fn(...args)
    }
    this.atom()
    return result!
  }

  get(): T {
    let { context } = this.closest(top())
    let value = context.get(this)
    if (value === undefined) {
      context.set(this, (value = this.defaultValue))
    }

    return value as T
  }
}

class Snapshot {
  constructor(public frame = top()) {}

  run<I extends any[], O>(fn: Fn<I, O>, ...args: I): O {
    let _top = TOP
    TOP = this.frame
    try {
      return fn(...args)
    } finally {
      TOP = _top
    }
  }
}

// https://github.com/tc39/proposal-async-context#chrome-async-stack-tagging-api
export let AsyncContext = {
  Variable,
  Snapshot,
}

let copy = (store: WeakMap<Atom, Frame>, frame: Frame, cause: Frame) => {
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

let enqueue = (frame: Frame, store: WeakMap<Atom, Frame>, queue: Array<Fn>) => {
  for (let i = 0; i < frame.subs.length; i++) {
    let subFrame = store.get(frame.subs[i]!)!

    if (subFrame.subs.length) {
      enqueue(copy(store, subFrame, frame), store, queue)
    } else if (
      // TODO not reliable
      subFrame.atom.name.endsWith(EFFECT_KEY)
    ) {
      queue.push(subFrame.atom)
    }
  }
  frame.subs = []
}

// TODO configurable
export let notify = () => {
  for (const fn of root().state.splice(0)) fn()
}

let i = 0
export let named = (name: string | TemplateStringsArray) => `${name}#${++i}`

export let reatom: {
  <T>(computed: (() => T) | ((state?: T) => T), name?: string): ComputedAtom<T>
  <T>(init: T extends Fn ? never : T, name?: string): Atom<T>
} = <T>(
  init: T | (() => T) | ((state?: T) => T),
  name = named`reatom`,
): Atom<T> => {
  let atom = {
    [name]() {
      {
        let cause = top()
        let store = storeAsyncVariable.get()
        let frame = store.get(atom)

        if (!frame) {
          frame = {
            error: null,
            state: typeof init === 'function' ? undefined : init,
            atom,
            cause,
            context: null,
            pubs: [],
            subs: [],
          }
          store.set(atom, frame)
        } else if (arguments.length) {
          frame = copy(store, frame, cause)
        }

        if (cause.atom !== root && !arguments.length) cause.pubs.push(frame)

        try {
          if (frame.error !== null) throw frame.error

          if (!frame.subs.length || arguments.length) {
            let { error, state } = frame
            if (typeof init === 'function') {
              TOP = root()
              if (
                frame.pubs.length === 0 ||
                frame.pubs.some(({ atom, state }) => !Object.is(state, atom()))
              ) {
                TOP = frame
                frame.pubs = []
                // TODO unlinking!
                frame.state = (init as Fn)(state, arguments[0])
              }
            }

            if (arguments.length !== 0) {
              frame.state = arguments[0]
            }

            if (
              (!Object.is(state, frame.state) || error != null) &&
              frame.subs.length
            ) {
              let queue = root().state
              if (queue.length === 0) {
                Promise.resolve().then(bind(notify, root()))
              }
              enqueue(frame, store, queue)
            }
          }
        } catch (error) {
          throw (frame.error = error ?? new Error('Unknown error'))
        } finally {
          if (cause.atom !== root && !arguments.length) {
            frame.subs.push(cause.atom)
          }
          TOP = cause
        }

        return frame.state
      }
    },
  }[name] as Atom<T>

  atom.reatom = 'atom'

  return atom
}

let EFFECT_KEY = '(REATOM_EFFECT)'
export let effect = (fn: Fn, name?: string): Unsubscribe => {
  reatom(() => {
    fn()
  }, name + EFFECT_KEY)()
  // TODO
  return () => {}
}

let storeAsyncVariable = new AsyncContext.Variable({
  name: 'store',
  defaultValue: new WeakMap<Atom, Frame>(),
})

let root = (() => {
  let frame = top()
  // TODO package duplication
  while (frame.atom !== root) frame = frame.cause
  return frame
}) as Atom<Frame<Array<Fn>>>
root.reatom = 'atom'
export let createRootSnapshot = () => {
  let frame: Frame = {
    error: null,
    state: [],
    atom: root,
    cause: undefined as unknown as Frame,
    context: new Map(),
    pubs: [],
    subs: [],
  }
  frame.cause = frame

  let snapshot = new AsyncContext.Snapshot(frame)

  let store = new WeakMap()
  frame.context!.set(storeAsyncVariable, store)
  store.set(root, frame)

  return snapshot
}

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
    let _top: typeof TOP
    let start = () => {
      _top = TOP
      TOP = snapshot.frame
    }
    let end = () => {
      snapshot.run(noop)
      TOP = _top
    }
    try {
      let value = await target
      var sealed = () => resolve(value)
    } catch (error) {
      sealed = () => reject(error)
    }
    Promise.resolve().then(start)
    sealed()
    Promise.resolve().then(end)
  }) as T
}

TOP = createRootSnapshot().frame

let a0 = reatom(0, 'a0')
let a1 = reatom(() => a0(), 'a1')
let a2 = reatom(() => a1() + 1, 'a2')
let a3 = reatom(() => a1() + 1, 'a3')
let a4 = reatom(() => a2() + a3(), 'a4')
let a5 = reatom(() => a4() + 1, 'a5')
let a6 = reatom(() => a4() + a5(), 'a6')
let a7 = reatom(() => a4() + a5(), 'a7')
let a8 = reatom(() => a6() + a7(), 'a8')

effect(async () => {
  const v = a8() //?

  await bind(new Promise<void>((res, rej) => setTimeout(res)))

  if (v > 100) {
    throw new Error('TEST')
  }

  a0(v)
})
