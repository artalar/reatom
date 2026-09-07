import type { AtomLike, Ext } from '../core'
import { isAtom, isConnected } from '../core'
import { withCallHook, withConnectHook } from '../extensions'
import { retryComputed, wrap } from '../methods'
import type { MaybeUnsubscribe } from '../utils'
import { isAbort, isBrowser, noop, setTimeout } from '../utils'
import type { AsyncExt } from './withAsync'
import { withAsync } from './withAsync'

export interface RetryQueue {
  push: (task: () => Promise<unknown>) => Promise<unknown>
}

export interface RetryQueueOptions {
  maxParallel?: number
}

export interface RetryBudget {
  take: () => boolean
  reset: () => void
}

export interface RetryBudgetOptions {
  limit?: number
  interval?: number
}

export interface ExponentialBackoffOptions {
  base?: number
  factor?: number
  max?: number
  jitter?: boolean | number
}

export type RetryDelay = number | ((attempt: number, error: unknown) => number)

export interface RetryEvent<
  Params extends unknown[] = unknown[],
  Payload = unknown,
> {
  target: AtomLike<unknown, Params, Promise<Payload>>
  params: Params
  retry: () => Promise<Payload>
  connected: () => boolean
}

export interface RetryRejectEvent<
  Params extends unknown[] = unknown[],
  Payload = unknown,
> extends RetryEvent<Params, Payload> {
  error: unknown
  attempt: number
}

export interface RetryFulfillEvent<
  Params extends unknown[] = unknown[],
  Payload = unknown,
> extends RetryEvent<Params, Payload> {
  payload: Payload
}

export interface RetryConnectEvent<Payload = unknown> {
  retry: () => Promise<Payload | undefined>
  connected: () => boolean
}

export interface RetryOnRejectStrategy<
  Params extends unknown[] = unknown[],
  Payload = unknown,
> {
  (event: RetryRejectEvent<Params, Payload>): void
  onFulfill?: (event: RetryFulfillEvent<Params, Payload>) => void
}

export interface RetryOnFulfillStrategy<
  Params extends unknown[] = unknown[],
  Payload = unknown,
> {
  (event: RetryFulfillEvent<Params, Payload>): void
  connect?: (event: RetryConnectEvent<Payload>) => MaybeUnsubscribe
}

export interface RetryOnRejectOptions {
  delay?: RetryDelay
  budget?: number | RetryBudget
  queue?: RetryQueue
}

export interface RetryOnFulfillOptions {
  staleTime?: number
  focus?: boolean
  reconnect?: boolean
}

export interface WithRetryOptions<
  Params extends unknown[] = unknown[],
  Payload = unknown,
> {
  connected?: boolean
  onReject?:
    | false
    | RetryOnRejectStrategy<Params, Payload>
    | Array<RetryOnRejectStrategy<Params, Payload>>
  onFulfill?:
    | false
    | RetryOnFulfillStrategy<Params, Payload>
    | Array<RetryOnFulfillStrategy<Params, Payload>>
}

type RetryTarget<Params extends unknown[], Payload> = AtomLike<
  unknown,
  Params,
  Promise<Payload>
> &
  AsyncExt<Params, Payload, unknown>

let hasAsyncExt = <Params extends unknown[], Payload>(
  target: AtomLike<unknown, Params, Promise<Payload>>,
): target is RetryTarget<Params, Payload> =>
  'onReject' in target && 'onFulfill' in target && 'retry' in target

let toArray = <T>(value: undefined | false | T | Array<T>): Array<T> =>
  value === undefined || value === false
    ? []
    : Array.isArray(value)
      ? value
      : [value]

let getDelay = (delay: RetryDelay, attempt: number, error: unknown) =>
  typeof delay === 'function' ? delay(attempt, error) : delay

let wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

let getConnectionTarget = <Params extends unknown[], Payload>(
  target: RetryTarget<Params, Payload>,
) => ('data' in target && isAtom(target.data) ? target.data : target)

export let retryQueue = ({
  maxParallel = 1,
}: RetryQueueOptions = {}): RetryQueue => {
  let active = 0
  let queue = new Array<() => void>()

  let runNext = () => {
    if (active >= maxParallel) return
    queue.shift()?.()
  }

  return {
    push(task) {
      return new Promise<unknown>((resolve, reject) => {
        let run = () => {
          active++
          task()
            .then(resolve, reject)
            .finally(() => {
              active--
              runNext()
            })
        }

        if (active < maxParallel) run()
        else queue.push(run)
      })
    },
  }
}

export let retryBudget = ({
  limit = Infinity,
  interval = Infinity,
}: RetryBudgetOptions = {}): RetryBudget => {
  let left = limit
  let startedAt = Date.now()

  return {
    take() {
      if (Date.now() - startedAt >= interval) {
        left = limit
        startedAt = Date.now()
      }

      if (left <= 0) return false

      left--

      return true
    },
    reset() {
      left = limit
      startedAt = Date.now()
    },
  }
}

export let exponentialBackoff =
  ({
    base = 1_000,
    factor = 2,
    max = 30_000,
    jitter = false,
  }: ExponentialBackoffOptions = {}): RetryDelay =>
  (attempt) => {
    let delay = Math.min(base * factor ** Math.max(0, attempt - 1), max)

    if (jitter === true) return Math.random() * delay
    if (typeof jitter === 'number' && jitter > 0) {
      let min = Math.max(0, delay * (1 - jitter))
      let max = delay * (1 + jitter)

      return min + Math.random() * (max - min)
    }

    return delay
  }

export let retryOnReject = <
  Params extends unknown[] = unknown[],
  Payload = unknown,
>({
  delay = 1_000,
  budget,
  queue,
}: RetryOnRejectOptions = {}): RetryOnRejectStrategy<Params, Payload> => {
  let retryBudgetState =
    typeof budget === 'number' ? retryBudget({ limit: budget }) : budget

  let strategy: RetryOnRejectStrategy<Params, Payload> = (event) => {
    if (isAbort(event.error)) return
    if (retryBudgetState && !retryBudgetState.take()) return

    let task = async () => {
      await wrap(wait(getDelay(delay, event.attempt, event.error)))
      if (!event.connected()) return
      await wrap(event.retry().catch(noop))
    }

    if (queue) queue.push(task).catch(noop)
    else task().catch(noop)
  }

  strategy.onFulfill = () => retryBudgetState?.reset()

  return strategy
}

export let revalidateOnFulfill = <
  Params extends unknown[] = unknown[],
  Payload = unknown,
>({
  staleTime,
  focus = false,
  reconnect = false,
}: RetryOnFulfillOptions = {}): RetryOnFulfillStrategy<Params, Payload> => {
  let latest: undefined | RetryFulfillEvent<Params, Payload>
  let updatedAt = 0
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  let clear = () => {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    timeoutId = undefined
  }

  let isStale = () =>
    latest !== undefined &&
    (staleTime === undefined || Date.now() - updatedAt >= staleTime)

  let retry = () => {
    if (latest && latest.connected() && isStale()) {
      latest.retry().catch(noop)
    }
  }

  let strategy: RetryOnFulfillStrategy<Params, Payload> = (event) => {
    latest = event
    updatedAt = Date.now()
    clear()

    if (staleTime !== undefined) {
      timeoutId = setTimeout(wrap(retry), staleTime)
    }
  }

  strategy.connect = () => {
    if (!isBrowser()) return

    let onFocus = wrap(() => {
      if (focus) retry()
    })
    let onOnline = wrap(() => {
      if (reconnect) retry()
    })

    window.addEventListener('focus', onFocus)
    window.addEventListener('online', onOnline)

    return () => {
      clear()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('online', onOnline)
    }
  }

  return strategy
}

export let withRetry =
  <Params extends unknown[], Payload>(
    options: WithRetryOptions<Params, Payload> = {},
  ): Ext<AtomLike<unknown, Params, Promise<Payload>>> =>
  (target) => {
    if (!hasAsyncExt(target)) {
      withAsync({ cacheParams: true })(target)
    }

    if (!hasAsyncExt(target)) return target

    let connectedOnly = options.connected ?? true
    let connectionTarget = getConnectionTarget(target)
    let attempts = 0
    let latest: undefined | RetryFulfillEvent<Params, Payload>
    let onRejectStrategies = toArray(
      options.onReject === undefined
        ? retryOnReject<Params, Payload>()
        : options.onReject,
    )
    let onFulfillStrategies = toArray(options.onFulfill)
    let connected = () => !connectedOnly || isConnected(connectionTarget)
    let retry = (params: Params) => () =>
      Promise.resolve(
        target.__reatom.reactive ? retryComputed(target) : target(...params),
      )

    target.onReject.extend(
      withCallHook(({ error, params }) => {
        if (!connected()) return

        let event: RetryRejectEvent<Params, Payload> = {
          target,
          params,
          error,
          attempt: ++attempts,
          retry: retry(params),
          connected,
        }

        onRejectStrategies.forEach((strategy) => strategy(event))
      }),
    )

    target.onFulfill.extend(
      withCallHook(({ payload, params }) => {
        if (!connected()) return

        attempts = 0

        latest = {
          target,
          params,
          payload,
          retry: retry(params),
          connected,
        }

        let event = latest

        onRejectStrategies.forEach((strategy) => strategy.onFulfill?.(event))
        onFulfillStrategies.forEach((strategy) => strategy(event))
      }),
    )

    onFulfillStrategies.forEach((strategy) => {
      if (strategy.connect) {
        connectionTarget.extend(
          withConnectHook(() =>
            strategy.connect?.({
              retry: () =>
                latest ? latest.retry() : Promise.resolve(undefined),
              connected,
            }),
          ),
        )
      }
    })

    return target
  }
