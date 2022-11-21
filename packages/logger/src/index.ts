import {
  action,
  AtomCache,
  AtomProto,
  Ctx,
  Fn,
  Rec,
  __root,
} from '@reatom/core'

export interface LogMsg {
  error: undefined | Error
  changes: Rec
  logs: Array<AtomCache>
  ctx: Ctx
}

export const getCause = (patch: AtomCache) => {
  let log = ''
  let cause: typeof patch.cause = patch

  while (cause.cause !== null && cause.cause.proto !== __root) {
    if (log.length > 0) log += ' <-- '
    log += (cause = cause.cause).proto.name ?? 'unnamed'
  }

  return log || 'root'
}

const getTimeStampDefault = () => {
  let ms: number | string = new Date().getMilliseconds()
  ms = ms.toString().padStart(3, '0')
  return `${new Date().toLocaleTimeString()} ${ms}ms`
}

export const createLogBatched = ({
  debounce = 500,
  getTimeStamp = getTimeStampDefault,
  limit = 5000,
  log = console.log,
}: {
  debounce?: number
  getTimeStamp?: () => string
  limit?: number
  log?: typeof console.log
} = {}) => {
  let queue: Array<LogMsg & { time: string }> = []
  let isBatching = false
  let batchingStart = Date.now()
  const logBatched = (msg: LogMsg) => {
    if (Object.keys(msg.changes).length === 0) return

    if (!isBatching) {
      isBatching = true
      batchingStart = Date.now()
    }

    setTimeout(
      (length) => {
        isBatching =
          queue.length !== length && Date.now() - batchingStart < limit

        if (isBatching) return

        // console.groupCollapsed(`Reatom ${length} logs`)
        log(
          queue.reduce((acc, { changes, time }, i) => {
            acc[`${i + 1}.0.___timestamp___`] = time
            for (const k in changes) acc[`${i + 1}.${k}`] = changes[k]
            return acc
          }, {} as Rec),
          queue,
        )
        // console.groupEnd()
        queue = []
      },
      debounce,
      queue.push(Object.assign(msg, { time: getTimeStamp() })),
    )
  }

  return logBatched
}

// export const log = action((ctx, message: any, name?: string) => ({
//   message,
//   name,
// }), '@reatom/logger.log')

// declare global {
//   REATOM_LOG: typeof log
// }

// globalThis.REATOM_LOG = log

export const connectLogger = (
  ctx: Ctx,
  {
    log = createLogBatched(),
    showCause = false,
    skipUnnamed = true,
  }: {
    log?: Fn<[LogMsg]>
    showCause?: boolean
    skipUnnamed?: boolean
  } = {},
) => {
  let read: Fn<[AtomProto], undefined | AtomCache>
  ctx.get((r) => (read = r))

  return ctx.subscribe((logs, error) => {
    const states = new Map<AtomProto, any>()
    const changes = logs.reduce((acc, patch, i) => {
      const { proto, state } = patch
      let { name } = proto

      if (!name) {
        if (skipUnnamed) return acc
        name = 'unnamed'
      }

      const prevState = states.has(proto)
        ? states.get(proto)
        : read(proto)?.state
      states.set(proto, state)

      if (Object.is(state, prevState)) return acc

      const logName = `${i + 1}.${name}`

      acc[logName] = proto.isAction ? state.at(-1) : state

      if (showCause) acc[`${i + 1}.___cause___`] = getCause(patch)

      return acc
    }, {} as Rec)

    log({
      error,
      changes,
      logs,
      ctx,
    })
  })
}
