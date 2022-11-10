import { AtomCache, AtomProto, Ctx, Fn, Rec, __root } from '@reatom/core'

export interface LogMsg {
  error: undefined | Error
  changes: Rec
  logs: Array<AtomCache>
  ctx: Ctx
}

const countify = (s: string, i: number, list: Array<any>) =>
  `[${`${i + 1}`.padStart(list.length.toString().length, '0')}] ${s}`

export const getCause = (patch: AtomCache) => {
  let log = ''
  let cause: typeof patch.cause = patch

  while (cause.cause !== null && cause.cause.proto !== __root) {
    if (log.length > 0) log += ' <-- '
    log += (cause = cause.cause).proto.name ?? 'unnamed'
  }

  return log || 'root'
}

export const createLogBatched = ({
  debounce = 20,
  getTimeStamp = () => new Date().toLocaleTimeString(),
  limit = 5000,
  log = console.log,
}: {
  debounce?: number
  getTimeStamp?: () => string
  limit?: number
  log?: typeof console.log
} = {}) => {
  let queue: Array<LogMsg & { time: string }> = []
  let lastLog = Date.now()
  const logBatched = (msg: LogMsg) => {
    if (Object.keys(msg.changes).length === 0) return
    setTimeout(
      (length) => {
        if (queue.length !== length && Date.now() - lastLog < limit) return

        lastLog = Date.now()

        // console.groupCollapsed(`Reatom ${length} logs`)
        log(
          queue.reduce((acc, { changes, time }, i) => {
            acc[`--- update ${i + 1} ---`] = time
            for (const k in changes) acc[k] = changes[k]
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

      const logName = countify(name, i, logs)

      acc[logName] = proto.isAction ? state.at(-1) : state

      if (showCause) acc[`${logName} cause`] = getCause(patch)

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
