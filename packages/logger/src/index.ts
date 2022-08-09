import { AtomCache, AtomMeta, Ctx, Fn, Rec } from '@reatom/core'

export interface LogMsg {
  error: undefined | Error
  changes: Rec
  logs: Array<AtomCache>
  ctx: Ctx
}

export const getCause = (patch: AtomCache) => {
  let log = `self`
  let cause: typeof patch.cause = patch

  while (cause !== cause.cause && cause.cause !== null) {
    log += ' <-- ' + ((cause = cause.cause).meta.name ?? 'unnamed')
  }

  return log
}

export const createLogBatched = (log = console.log) => {
  let queue: Array<LogMsg> = []
  const logBatched = (msg: LogMsg) => {
    Promise.resolve(queue.push(msg)).then((length) => {
      if (queue.length !== length) return

      console.groupCollapsed(`Reatom ${length} logs`)
      log(
        queue.reduce((acc, { changes }, i) => {
          for (const k in changes) acc[`[${i + 1}] ${k}`] = changes[k]
          return acc
        }, {} as Rec),
        queue,
      )
      console.groupEnd()
      queue = []
    })
  }

  return logBatched
}

export const connectLogger = (
  ctx: Ctx,
  {
    log = createLogBatched(),
    skipEmpty = true,
    showCause = true,
  }: {
    log?: Fn<[LogMsg]>
    skipEmpty?: boolean
    showCause?: boolean
  } = {},
) => {
  let read: Fn<[AtomMeta], undefined | AtomCache>
  ctx.get((r) => (read = r))

  return ctx.subscribe((logs, error) => {
    const counter = new Map<AtomMeta, number>()
    let empty = true
    const changes = logs.reduce((acc, patch) => {
      const { meta, state } = patch
      const { name } = meta
      const stateOld = read(meta)?.state

      counter.set(meta, (counter.get(meta) ?? 0) + 1)

      if (!name || Object.is(state, stateOld)) return acc

      empty = false

      const message = showCause
        ? {
            state,
            stateOld,
            get cause() {
              return getCause(patch)
            },
          }
        : state

      if (name in acc) {
        if (counter.get(meta)! > 1) acc[name] = [acc[name]]
        acc[name].push(message)
      } else {
        acc[name] = message
      }

      return acc
    }, {} as Rec)

    if (skipEmpty && empty) return

    log({
      error,
      changes,
      logs,
      ctx,
    })
  })
}
