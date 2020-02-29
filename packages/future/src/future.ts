import { STOP, Queue, Fn, Collection, callSafety, clearTag } from '.'

export type Uid = string

export type Thened<T> = T extends Promise<infer T> ? T : T
export type Filtered<T> = T extends STOP ? never : T

export type RefCache = Collection<any>
export class Ref {
  cache: RefCache = {}
  cleanup?: Fn | void
  links: Future<any, any>[] = []
}

export type CtxLinks = Map<Uid, Ref>
export class Ctx {
  private _lifeCycleQueue: Fn[] = []
  private _links: CtxLinks = new Map()
  // private _subscriptions: Fn<[RunCtx]>[] = []

  private _link(target: Future<any, any>, dependent: Future<any, any>) {
    let targetRef = this.getRef(target)

    if (targetRef === undefined) {
      this._links.set(target.uid, (targetRef = new Ref()))
      // init life cycle method must be called starts from parent to child
      target.deps.forEach(dep => this._link(dep, target))
      if (target.init !== undefined) {
        this._lifeCycleQueue.push(() => {
          targetRef!.cleanup = target.init!(target, targetRef!.cache, this)
        })
      }
    }

    targetRef.links.push(dependent)
  }

  private _unlink(target: Future<any, any>, dependent: Future<any, any>) {
    const targetRef = this.getRef(target)

    if (targetRef !== undefined) {
      targetRef.links.splice(targetRef.links.indexOf(dependent), 1)

      if (targetRef.links.length === 0) {
        this._links.delete(target.uid)
        // cleanup life cycle method must be called starts from child to parent
        if (targetRef.cleanup) {
          this._lifeCycleQueue.push(targetRef.cleanup)
        }
        target.deps.forEach(dep => this._unlink(dep, target))
      }
    }
  }

  private _lifeCycle() {
    while (this._lifeCycleQueue.length !== 0)
      // it will be good to catch an errors and do rollback of the linking
      // but it not required for all users and implementation code is not tree-shackable
      // so it good for implementing in some extra package by Ctx extending
      callSafety(this._lifeCycleQueue.shift()!)
  }

  // subscribe<T>(cb: Fn<[RunCtx]>): () => void
  subscribe<T>(
    cb: Mapper<ChainedValue<T>, any>,
    target: Future<any, T>,
  ): () => void
  subscribe<T>(cb: Fn<any>, target: Future<any, T>): () => void {
    let isSubscribed = true

    // if (target === undefined) {
    //   this._subscriptions.push(cb)

    //   const unsubscribe = () => {
    //     if (isSubscribed) {
    //       isSubscribed = false
    //       this._subscriptions.splice(this._subscriptions.indexOf(cb), 1)
    //     }
    //   }
    //   return unsubscribe
    // }

    const dependent = new Future<T, void>({
      deps: [target],
      name: `subscriber of ${target.name}`,
      mapper: (v, cache, runCtx) => callSafety(cb, v, cache, runCtx),
    })
    this._link(target, dependent)
    this._lifeCycle()

    const unsubscribe = () => {
      if (isSubscribed) {
        isSubscribed = false
        this._unlink(target, dependent)
        this._lifeCycle()
      }
    }
    return unsubscribe
  }

  getRef(target: Future<any, any>): Ref | undefined {
    return this._links.get(target.uid)
  }
}

export type RunPayload = unknown
export class RunCtx {
  private _queue = Queue<Future<any, any>>()
  payload = new Map<Future<any, any>, RunPayload>()
  constructor(public ctx = new Ctx()) {}

  schedule(links: Ref['links']) {
    links.forEach(f => this._queue.insert(f.depth, f))
  }

  next() {
    const f = this._queue.extract()

    return f === undefined ? () => {} : f.executor
  }
}

type BaseLifeCycleHook = Fn<[BaseFuture, RefCache, Ctx], Fn | void>
class BaseFuture {
  constructor({
    ctx,
    deps,
    executor,
    init,
    name,
  }: {
    ctx: Ctx
    deps: BaseFuture[]
    executor: Fn<[RunCtx]>
    init: BaseLifeCycleHook
    name: string
  }) {
    this.ctx = ctx
    this.deps = deps
    this.executor = executor
    this.init = init
    this.name = name
  }

  pipe(...a: ((future: this) => void)[]) {
    return a.reduce((acc, f) => , this)
  }
}

export type Executor<Input, Output> = Fn<[RunCtx], any>
export type ChainedValue<T> = Filtered<Thened<T>>
export type Mapper<Input, Output> = Fn<[Input, RefCache, RunCtx], Output>

export type LifeCycleHook<Input, Output> = Fn<
  [Future<Input, Output>, RefCache, Ctx],
  Fn | void
>

export type CommonOptions<Input, Output> = {
  ctx?: Ctx
  init?: LifeCycleHook<Input, Output>
  name?: string
}
export type ConstructorOptions<Input, Output> = CommonOptions<Input, Output> & {
  deps?: [Future<any, any>] | Future<any, any>[]
  mapper?: Mapper<Input, Output>
}

export type FutureInput<F> = F extends Future<infer T, any> ? T : never
export type FutureOutput<F> = F extends Future<any, infer T> ? T : never
export type ChainInput<Dependency> = ChainedValue<FutureOutput<Dependency>>
export type ChainOutput<Output, T> = Output extends Promise<infer O>
  ? Promise<O extends STOP ? Thened<T> | STOP : Thened<T>>
  : Output extends STOP
  ? T | STOP
  : T

export type ForkOutput<Output> = Output extends Promise<infer T>
  ? T extends STOP
    ? undefined
    : T
  : Output extends STOP
  ? undefined
  : Output

let _id = 0
export class Future<Input, Output> {
  static ctx = new Ctx()
  static createUid = (name: string): Uid => `${name} [${++_id}]`

  static from<Input, Output>(
    mapper: Mapper<Input, Output>,
    options?: CommonOptions<Input, Output>,
  ): Future<Input, Output>
  static from<Output>(
    mapper: Fn<[], Output>,
    options?: CommonOptions<undefined, Output>,
  ): Future<undefined, Output>
  static from(
    mapper: Mapper<any, any>,
    { ctx, init, name = 'Future.from' }: CommonOptions<any, any> = {},
  ) {
    return new Future({
      ctx,
      init,
      mapper,
      name,
    })
  }

  static of<T>(): Future<T, T>
  static of<T>(
    value: T,
    options?: CommonOptions<T | undefined, T>,
  ): Future<T | undefined, T>
  static of(
    value?: any,
    { ctx, init, name = 'Future.of' }: CommonOptions<any, any> = {},
  ) {
    return Future.from((payload = value) => payload, { ctx, init, name })
  }

  readonly ctx: Ctx
  readonly deps: Future<any, Input>[]
  readonly depth: number
  readonly executor: Executor<Input, Output>
  readonly init?: LifeCycleHook<Input, Output>
  readonly name: string
  readonly uid: Uid

  constructor({
    ctx = Future.ctx,
    deps = [],
    init,
    mapper = (v: any) => v,
    name = 'Future',
  }: ConstructorOptions<Input, Output>) {
    const me = this
    const uid = Future.createUid(name)
    const executor: Executor<Input, Output> = {
      [uid](runCtx: RunCtx) {
        // TODO: undefined?
        const input = me._read(runCtx)!
        const ref = runCtx.ctx.getRef(me) || new Ref()

        const output: any = mapper(input, ref.cache, runCtx)
        me._write(runCtx, output)

        if (output !== STOP) {
          if (output instanceof Promise) {
            output.then(value => {
              me._write(runCtx, value)

              if (value !== STOP) {
                runCtx.schedule(ref.links)
              }

              runCtx.next()(runCtx)
            })
          } else {
            runCtx.schedule(ref.links)
          }
        }

        runCtx.next()(runCtx)
      },
    }[name]

    this.ctx = ctx
    this.deps = deps
    this.depth = deps.reduce((acc, v) => Math.max(acc + 1, v.depth), 0)
    this.executor = executor
    this.init = init
    this.name = name
    this.uid = uid
  }

  _read(runCtx: RunCtx): Input | undefined {
    return this.deps.length === 0
      ? runCtx.payload.get(this)
      : this.deps.length === 1
      ? runCtx.payload.get(this.deps[0])
      : (this.deps.map(f => runCtx.payload.get(f)) as any)
  }

  _write(runCtx: RunCtx, value: Output) {
    runCtx.payload.set(this, value)
  }

  _fork(input: Input, runCtx: RunCtx) {
    if (this.deps.length === 0) {
      this._write(runCtx, input as any)
      runCtx.schedule([this])
    }
    this.deps.forEach(f => f._fork(input, runCtx))
  }

  subscribe(cb: Mapper<ChainedValue<Output>, any>, ctx = this.ctx): () => void {
    return ctx.subscribe(cb, this)
  }

  chain<T>(
    mapper: Mapper<ChainedValue<Output>, T>,
    {
      ctx,
      init,
      name = `chain of ${this.name}`,
    }: CommonOptions<Input, ChainOutput<Output, T>> = {},
  ): Future<Input, ChainOutput<Output, T>> {
    return new Future<any, any>({
      ctx,
      deps: [this],
      init,
      mapper,
      name,
    })
  }

  bind(ctx: Ctx) {
    return this.chain(v => v, { ctx, name: this.name })
  }

  // TODO: ignore `init`? :thinking:
  fork(): Input extends undefined ? ForkOutput<Output> : never
  fork(input: Input, ctx?: Ctx | RunCtx): ForkOutput<Output>
  fork(input?: Input, ctx: Ctx | RunCtx = this.ctx): any {
    let runCtx: RunCtx
    if (ctx instanceof RunCtx) runCtx = ctx
    else if (ctx instanceof Ctx) runCtx = new RunCtx(ctx)
    else throw new TypeError('Reatom: invalid context')

    let resolve: Fn = () => {}
    const promise = new Promise(r => (resolve = r))

    this._fork(input!, runCtx)
    const cleanup = this.subscribe((v, cache, _runCtx) => {
      if (_runCtx !== runCtx) return
      cleanup()
      resolve(v)
    }, runCtx.ctx)
    runCtx.next()(runCtx)

    if (runCtx.payload.has(this)) return clearTag(runCtx.payload.get(this))
    // if (runCtx.hasPromise(this)) return promise.then(clearTag)
    // else return undefined
  }

  run(input: Input): ForkOutput<Output> {
    const ctx = new Ctx()
    // create links and cache it
    ctx.subscribe(() => {}, this)
    this.run = (input: Input) => this.fork(input, ctx)
    return this.run(input)
  }
}

export function reduce<T, F extends Future<any, any>>(
  future: F,
  reducer: (state: T, payload: ChainInput<F>) => T,
): [F, Fn<[T, ChainInput<F>], T>] {
  return [future, reducer]
}

export class Atom<State> extends Future<State, State> {
  defaultState!: State

  static create<T>(
    initState: T,
    ...a:
      | [[Future<any, any>, Fn<[T, any], T>]]
      | [Future<any, any>, Fn<[T, any], T>][]
  ): Atom<T> {
    const atom = new Atom<T>({
      deps: a.map(([f]) => f),
      init(me, cache, ctx) {
        cache.state = initState
        cache.last = new Array(a.length)
      },
      // @ts-ignore
      mapper(input: any, cache: { state: T; last: unknown[] }, runCtx) {
        const newState = runCtx.payload.get(atom) as T
        let { state, last } = cache
        let isChanged = false
        if (last.length === 1) input = [input]

        if (newState !== undefined) {
          return newState !== state ? (cache.state = newState) : STOP
        }

        for (let i = 0; i < last.length; i++) {
          const depValue = input[i]
          if (depValue !== undefined && depValue !== last[i]) {
            isChanged = true
            state = cache.state = a[i][1](state, (last[i] = depValue))
          }
        }

        return isChanged ? state : STOP
      },
    })

    atom.defaultState = initState

    atom._fork = (input: T = initState, runCtx: RunCtx) => {
      atom._write(runCtx, input)
      runCtx.schedule([atom])
    }

    return atom
  }

  reduce<T>(reducer: Fn<[T, State], T>): [this, Fn<[T, State], T>] {
    return [this, reducer]
  }
}
