import { AtomCache, AtomMeta, Ctx, Fn, Rec } from '@reatom/core'

export const getCause = (patch: AtomCache) => {
  let log = `self`
  let cause: typeof patch.cause = patch

  while (cause !== cause.cause && cause.cause !== null) {
    log += ' <-- ' + ((cause = cause.cause).meta.name ?? 'unnamed')
  }

  return log
}

export const connectLogger = (
  ctx: Ctx,
  {
    log = console.log,
    showCause = true,
  }: { log?: typeof console.log; showCause?: boolean } = {},
) => {
  let read: Fn<[AtomMeta], undefined | AtomCache>
  ctx.get((r) => (read = r))

  return ctx.subscribe((logs, error) => {
    const counter = new Map<AtomMeta, number>()
    const changes = logs.reduce((acc, patch) => {
      const { meta, state } = patch
      const { name } = meta

      counter.set(meta, (counter.get(meta) ?? 0) + 1)

      if (!name || Object.is(state, read(meta)?.state)) return acc

      const message = showCause
        ? {
            state,
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

    log({
      error,
      changes,
      logs,
      ctx,
    })
  })
}
