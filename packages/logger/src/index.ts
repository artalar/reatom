import { Ctx, Rec } from '@reatom/core'

export const connectLogger = (
  ctx: Ctx,
  { log = console.log }: { log?: typeof console.log } = {},
) => {
  return ctx.log((logs) => {
    log(
      logs.reduce((acc, patch) => {
        if (
          patch.meta.name &&
          !Object.is(patch.state, ctx.read(patch.meta)?.state)
        ) {
          acc[patch.meta.name] = patch.state
        }

        return acc
      }, {} as Rec),
    )
  })
}
