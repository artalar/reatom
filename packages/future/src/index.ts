export type Fn<I extends unknown[] = unknown[], O = unknown> = (...a: I) => O
export type Then<T> = T extends Promise<infer T> ? T : T
export type Filter<T> = T extends undefined ? never : T

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

export class FutureRef {
  links: Future<any, any>[] = []
  cache = new Map<unknown, unknown>()
  cleanup?: Fn
}
export type UserFutureRef = FutureRef['cache']

export class Ctx {
  private links = new Map<Future<any, any>, FutureRef>()
  private lifeCycleQueue: Fn[] = []

  private _link(target: Future<any, any>, dependent: Future<any, any>) {
    const { links, lifeCycleQueue } = this
    let targetRef = links.get(target)

    if (targetRef === undefined) {
      links.set(target, (targetRef = new FutureRef()))
      // init life cycle method must be called starts from parent and to child
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
        // cleanup life cycle method must be called starts from child and to parent
        if (targetRef!.cleanup !== undefined) {
          lifeCycleQueue.push(targetRef!.cleanup!)
        }
        target.deps.forEach(dep => this.unlink(dep, target))
      }
    }
  }

  private _lifeCycle() {
    while (this.lifeCycleQueue.length !== 0)
      callSafety(this.lifeCycleQueue.shift()!)
  }

  getRef(target: Future<any, any>): FutureRef | undefined {
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

export class ProcessCtx extends Ctx {
  queue = Queue<Future<any, any>>()
  cache = new Map<unknown, unknown>()
}

export type Executor<Input, Output> = Fn<
  [Filter<Then<Input>>, UserFutureRef],
  Output
>

export type LifeCycleHook<Input, Output> = Fn<
  [Future<Input, Output>, Ctx],
  Fn | undefined
>

// TODO: test and improve
export type Deps<Input> = Input extends any[]
  ? Future<any, Input[number]> | [Future<any, Input>]
  : [Future<any, Input>]

export type ConstructorOptions<Input, Output> = {
  ctx?: Ctx
  deps?: Deps<Input>
  init?: LifeCycleHook<Input, Output>
  name?: string
}
export type MethodOptions<Input, Output> = Omit<
  ConstructorOptions<Input, Output>,
  'deps'
>

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
      {
        ctx,
        init,
        name,
      },
    )
  }
  static all<T extends [Future<any, any>] | Future<any, any>[]>(
    futures: T,
    {
      ctx,
      init,
      name = `"Future.all"`,
    }: MethodOptions<
      never,
      { [K in keyof T]: T[K] extends Future<any, infer T> ? T : never }
    > = {},
  ): Future<
    never,
    { [K in keyof T]: T[K] extends Future<any, infer T> ? T : never }
  > {
    return new Future(
      // @ts-ignore
      (payload: unknown[], cache) => {
        let map = cache.get(Future.all) as Map<Future<any, any>, unknown>
        if (map === undefined) cache.set(Future.all, (map = new Map()))

        const newPayload = payload.slice()
        let shouldContinue = true

        for (let i = 0; i < newPayload.length; i++) {
          let value = newPayload[i] //?
          if (value === undefined) {
            value = newPayload[i] = map.get(futures[i])
          } else {
            map.set(futures[i], value)
          }

          shouldContinue = shouldContinue && value !== undefined
        }

        if (shouldContinue) return newPayload
      },
      {
        ctx,
        deps: futures,
        init,
        name,
      },
    )
  }

  static race<T>(
    futures: Future<any, T>[],
    { ctx, init, name = `"Future.race"` }: MethodOptions<never, T> = {},
  ): Future<never, T> {
    // @ts-ignore
    return new Future(payload => payload.find(v => v !== undefined) as T, {
      ctx,
      deps: futures,
      init,
      name,
    })
  }

  private executor!: Fn<[ProcessCtx], Output>
  ctx!: Ctx
  deps!: Future<any, Input>[]
  depth!: number
  init?: LifeCycleHook<Input, Output>
  name!: string

  constructor(
    executor: Executor<Input, Output>,
    {
      ctx = Future.ctx,
      // @ts-ignore
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
      depth: (deps as Future<any, any>[]).reduce(
        (acc, v) => Math.max(acc + 1, v.depth),
        0,
      ),
      executor: {
        [executorName](pctx: ProcessCtx) {
          const input =
            me.deps.length === 0
              ? pctx.cache.get(me)
              : me.deps.length === 1
              ? pctx.cache.get(me.deps[0])
              : me.deps.map(f => pctx.cache.get(f))
          const ref = pctx.getRef(me)
          const isSubscriber = ref === undefined

          const result = executor(
            input as any,
            isSubscriber ? (null as any) : ref!.cache,
          )

          function resume(result: unknown) {
            if (!isSubscriber && result !== undefined) {
              pctx.cache.set(me, result)
              ref!.links.forEach(f => pctx.queue.insert(f.depth, f))
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

  private _findInput(): Future<Input, any> {
    switch (this.deps.length) {
      case 0:
        return this
      case 1:
        return this.deps[0]._findInput()
      default:
        // It may be implemented later
        throw new Error("React: can't fork combined future")
    }
  }

  subscribe(cb: Fn<[Filter<Then<Output>>]>, ctx = this.ctx) {
    const f = new Future<Output, any>(v => (callSafety(cb, v), v), {
      name: `subscriber of ${this.name}`,
      deps: ([this] as unknown) as Deps<Output>,
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

  map<T>(
    executor: (payload: Filter<Then<Output>>, ctx: UserFutureRef) => T,
    {
      name = `map of ${this.name}`,
      init,
      ctx,
    }: MethodOptions<
      Input,
      Output extends Promise<infer O>
        ? Promise<O extends undefined ? Then<T> | undefined : Then<T>>
        : Output extends undefined
        ? T | undefined
        : T
    > = {},
  ): Future<
    Input,
    Output extends Promise<infer O>
      ? Promise<O extends undefined ? Then<T> | undefined : Then<T>>
      : Output extends undefined
      ? T | undefined
      : T
  > {
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

  bind(ctx: Ctx): this {
    return Object.assign(Future.of(), this, { ctx })
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

    const unsubscribe = this.subscribe(() => {})

    const fDep = this._findInput()
    pctx.cache.set(fDep, input)

    let result!: Output
    try {
      result = fDep.executor(pctx) as Output
    } finally {
      if (result && result instanceof Promise) result.finally(unsubscribe)
      else unsubscribe()
    }

    return result
  }
}
