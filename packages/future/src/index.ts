export type Fn<I extends unknown[] = unknown[], O = unknown> = (...a: I) => O
export type Thened<T> = T extends Promise<infer T> ? T : T
export type Filtered<T> = T extends undefined ? never : T
export type Collection<T> = Record<keyof any, T>

export const { assign } = Object

export function noop() {}

export function callSafety<Arg>(fn: Fn<[Arg]> | Fn, arg?: Arg) {
  try {
    fn(arg!)
  } catch (e) {
    console.error(e)
  }
}

/** priority set queue for dynamic topological sorting */
export type Queue<T> = {
  insert: (priority: number, el: T) => void
  extract: () => T | undefined
}
export function Queue<T>(): Queue<T> {
  const parts = new Map<number, T[]>()
  let min = 0
  let max = 0

  return {
    insert(priority: number, el: T) {
      let part = parts.get(priority)
      if (part === undefined) parts.set(priority, (part = []))

      if (part.includes(el) === false) {
        part.push(el)
        min = Math.min(min, priority) // useful only for cycles
        max = Math.max(max, priority)
      }
    },
    extract() {
      let part = parts.get(min)
      while (part === undefined || part.length === 0) {
        if (min !== max) part = parts.get(++min)
        else return
      }
      return part.shift()
    },
  }
}

export type RefCache = Collection<unknown>
export class Ref {
  links: Future<any, any>[] = []
  cache: RefCache = {}
  cleanup?: Fn | void
}

export class Ctx {
  private links = new Map<Future<any, any>, Ref>()
  private lifeCycleQueue: Fn[] = []

  private _link(target: Future<any, any>, dependent: Future<any, any>) {
    const { links, lifeCycleQueue } = this
    let targetRef = links.get(target)

    if (targetRef === undefined) {
      links.set(target, (targetRef = new Ref()))
      // init life cycle method must be called starts from parent to child
      target.deps.forEach(dep => this.link(dep, target))
      if (target.init !== undefined) {
        lifeCycleQueue.push(
          () => (targetRef!.cleanup = target.init!(target, this)),
        )
      }
    }

    targetRef.links.push(dependent)
  }

  private _unlink(target: Future<any, any>, dependent: Future<any, any>) {
    const { links, lifeCycleQueue } = this
    const targetRef = links.get(target)

    if (targetRef !== undefined) {
      targetRef.links.splice(targetRef.links.indexOf(dependent), 1)

      if (targetRef.links.length === 0) {
        links.delete(target)
        // cleanup life cycle method must be called starts from child to parent
        if (targetRef!.cleanup !== undefined) {
          lifeCycleQueue.push(targetRef!.cleanup!)
        }
        target.deps.forEach(dep => this.unlink(dep, target))
      }
    }
  }

  private _lifeCycle() {
    while (this.lifeCycleQueue.length !== 0)
      // it will be good to catch an errors and do rollback of the links
      // but it not required for all users and implementation code is not tree-shackable
      // so it good for implementing in some extra package by Ctx extending
      callSafety(this.lifeCycleQueue.shift()!)
  }

  getRef(target: Future<any, any>): Ref | undefined {
    return this.links.get(target)
  }

  link(target: Future<any, any>, dependent: Future<any, any>) {
    this._link(target, dependent)
    this._lifeCycle()
  }
  unlink(target: Future<any, any>, dependent: Future<any, any>) {
    this._unlink(target, dependent)
    this._lifeCycle()
  }
}

export type ProcessCache = unknown
export class ProcessCtx extends Ctx {
  queue = Queue<Future<any, any>>()
  cache = new Map<Future<any, any>, ProcessCache>()
}

export type ExecutorValue<T> = Filtered<Thened<T>>

export type Executor<Input, Output> = Fn<
  [ExecutorValue<Input>, RefCache],
  Output
>

export type LifeCycleHook<Input, Output> = Fn<
  [Future<Input, Output>, Ctx],
  Fn | void
>

export type ConstructorOptions<Input, Output> = {
  ctx?: Ctx
  deps?: Future<any, any>[]
  init?: LifeCycleHook<Input, Output>
  name?: string
}
export type MethodOptions<Input, Output> = Omit<
  ConstructorOptions<Input, Output>,
  'deps'
>

export type FutureInput<F> = F extends Future<infer T, any> ? T : never
export type FutureOutput<F> = F extends Future<any, infer T> ? T : never

export type FutureListInput<
  Shape extends Future<any, any>[] | Collection<Future<any, any>>
> = { [K in keyof Shape]: FutureInput<Shape[K]> }
export type FutureListOutput<
  Shape extends Future<any, any>[] | Collection<Future<any, any>>
> = { [K in keyof Shape]: FutureOutput<Shape[K]> }

export type MappedFutureOutput<Output, T> = Output extends Promise<infer O>
  ? Promise<O extends undefined ? Thened<T> | undefined : Thened<T>>
  : Output extends undefined
  ? T | undefined
  : T

export class Future<Input, Output> {
  static ctx = new Ctx()
  static id = 0
  static createName = () => `[future #${++Future.id}]`

  static of<T>(): Future<T, T>
  static of<T>(
    value: T,
    options?: MethodOptions<T | undefined, T>,
  ): Future<T | undefined, T>
  static of<T>(
    value?: T,
    { init, ctx, name = `"Future.of"` }: MethodOptions<T | undefined, T> = {},
  ) {
    return new Future<T | undefined, T>(
      // @ts-ignore
      (payload = value) => payload,
      { ctx, init, name },
    )
  }

  static race<T>(
    futures: Future<any, T>[],
    { ctx, init, name = `"Future.race"` }: MethodOptions<never, T> = {},
  ): Future<never, T> {
    return new Future(
      (payload: T[]) => payload.find(v => v !== undefined) as T,
      {
        ctx,
        deps: futures,
        init,
        name,
      },
    )
  }

  static all<
    T extends
      | [Future<any, any>]
      | Future<any, any>[]
      | Collection<Future<any, any>>
  >(
    futures: T,
    {
      ctx,
      init,
      name = `"Future.all"`,
    }: MethodOptions<FutureListInput<T>, FutureListOutput<T>> = {},
  ): Future<FutureListInput<T>, FutureListOutput<T>> {
    const isArray = Array.isArray(futures)
    const keys = Object.keys(futures)
    const f = new Future(
      // @ts-ignore
      (payload: unknown[], cache: { map?: Map<Future<any, any>, unknown> }) => {
        let map = cache.map
        if (map === undefined) map = cache.map = new Map()

        const result: any = isArray ? [] : {}
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i] as any
          let value = payload[i]
          if (value === undefined) {
            value = map.get(futures[key])
          } else {
            map.set(futures[key], value)
          }
          if (value === undefined) return

          if (isArray) result.push(value)
          else result[key] = value
        }

        return result as []
      },
      {
        ctx,
        deps: keys.map((k: any) => futures[k]),
        init,
        name,
      },
    )

    f._fork = (input: FutureListInput<T>, pctx: ProcessCtx) => {
      keys.map((k: any) => futures[k]._fork(input[k], pctx))
    }

    return f
  }

  private _executor!: Executor<Input, Output>
  private _buildedExecutor?: Executor<Input, Output>
  private executor!: Fn<[ProcessCtx], Output>
  ctx!: Ctx
  deps!: Future<any, Input>[]
  depth!: number
  init?: LifeCycleHook<Input, Output>
  name!: string

  constructor(
    _executor: Executor<Input, Output>,
    {
      ctx = Future.ctx,
      deps = [],
      init,
      name = Future.createName(),
    }: ConstructorOptions<Input, Output> = {},
  ) {
    const me: Future<Input, Output> = this

    const executorName = name.startsWith('subscriber of ')
      ? name
      : `executor of "${name}"`

    assign(me, {
      name,
      deps,
      init,
      ctx,
      _executor,
      depth: deps.reduce((acc, v) => Math.max(acc + 1, v.depth), 0),
      executor: {
        [executorName](pctx: ProcessCtx) {
          const input =
            me.deps.length === 0
              ? pctx.cache.get(me)
              : me.deps.length === 1
              ? pctx.cache.get(me.deps[0])
              : me.deps.map(f => pctx.cache.get(f))
          const ref = pctx.getRef(me)!
          const isSubscriber = ref === undefined

          let result = _executor(
            input as any,
            isSubscriber ? (null as any) : ref.cache,
          )

          function resume(result: unknown) {
            if (isSubscriber === false && result !== undefined) {
              pctx.cache.set(me, result)
              ref.links.forEach(f => pctx.queue.insert(f.depth, f))
            }
            const next = pctx.queue.extract()
            return next === undefined ? result : next.executor(pctx)
          }

          return result && result instanceof Promise
            ? result.then(resume)
            : resume(result)
        },
      }[executorName],
    })
  }

  private _fork(input: Input, pctx: ProcessCtx) {
    if (this.deps.length === 0) {
      pctx.cache.set(this, input)
      pctx.queue.insert(this.depth, this)
    }
    this.deps.forEach(f => f._fork(input, pctx))
  }

  subscribe(cb: Fn<[ExecutorValue<Output>]>, ctx = this.ctx) {
    const f = new Future<Output, void>(v => (callSafety(cb, v), v), {
      name: `subscriber of ${this.name}`,
      deps: [this],
    })
    ctx.link(this, f)

    let isSubscribed = true
    return () => {
      if (isSubscribed) {
        isSubscribed = false
        ctx.unlink(this, f)
      }
    }
  }

  chain<T>(
    executor: Executor<Output, T>,
    {
      name = `map of ${this.name}`,
      init,
      ctx,
    }: MethodOptions<Input, MappedFutureOutput<Output, T>> = {},
  ): Future<Input, MappedFutureOutput<Output, T>> {
    return new Future(
      // @ts-ignore
      executor,
      {
        name,
        init,
        ctx,
        deps: [this],
      },
    )
  }

  bind(ctx: Ctx) {
    return this.chain(v => v, { ctx, name: this.name })
  }

  fork(input: Input, ctx: Ctx | ProcessCtx | null = this.ctx): Output {
    let pctx!: ProcessCtx
    if (ctx === null) {
      pctx = new ProcessCtx()
    } else if (ctx instanceof ProcessCtx) {
      pctx = ctx
    } else if (ctx instanceof Ctx) {
      pctx = assign(new ProcessCtx(), ctx)
    } else {
      throw new TypeError('Reatom: invalid context')
    }

    const cleanup = this.subscribe(() => {}, pctx)

    let result!: Output
    try {
      this._fork(input, pctx)
      result = pctx.queue.extract()!.executor(pctx)
    } finally {
      if (result && result instanceof Promise) result.finally(cleanup)
      else cleanup()
    }

    return result
  }

  // run(input: Input) {
  //   if (this._buildedExecutor === undefined) {
  //     this._buildedExecutor = this._executor

  //     let acc = this.deps
  //     while (acc.length) {
  //       const { _executor, deps } = acc[0]
  //       const dependent = this._buildedExecutor
  //       this._buildedExecutor = (input: Input) => {
  //         return dependent(_executor(input, {}))
  //       }
  //       acc = deps
  //     }
  //   }

  //   return this._buildedExecutor(input, {})
  // }
}
