import { AtomCache, AtomMeta, Ctx, Rec } from '@reatom/core'

const getName = ({ name = `unnamed` }: AtomMeta) => name

const getCause = (patch: AtomCache) => {
  let log = `self`
  let cause: typeof patch.cause = patch

  while (cause !== cause.cause && cause.cause !== null) {
    cause = cause.cause
    log += ` <-- ` + getName(cause.meta)
  }

  if (cause !== patch) log += ` <-- ` + getName(cause.meta)

  return log
}

export const connectLogger = (
  ctx: Ctx,
  {
    log = console.log,
    showCause = true,
  }: { log?: typeof console.log; showCause?: boolean } = {},
) => {
  return ctx.subscribe((logs, error) => {
    const counter = new Map<AtomMeta, number>()
    const changes = logs.reduce((acc, patch) => {
      const { meta, state } = patch

      counter.set(meta, (counter.get(meta) ?? 0) + 1)

      if (
        meta.name &&
        !Object.is(
          state,
          ctx.get((read) => read(meta)?.state),
        )
      ) {
        const { name } = meta
        const message = showCause ? { state, cause: getCause(patch) } : state

        if (name in acc) {
          if (counter.get(meta)! > 1) acc[name] = [acc[name]]
          acc[name].push(message)
        } else {
          acc[name] = message
        }
      }

      return acc
    }, {} as Rec)

    log({
      changes,
      logs,
      error,
    })
  })
}
