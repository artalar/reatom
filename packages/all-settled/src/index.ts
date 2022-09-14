import { Ctx, Fn } from '@reatom/core'

export const allSettled = (ctx: Ctx, cb: Fn<[Ctx]>): Promise<any> =>
  new Promise<void>((r) => {
    let i = 0,
      { schedule } = ctx

    return cb(
      (ctx = {
        ...ctx,
        schedule(cb, step) {
          return schedule.call<Ctx, Parameters<Ctx['schedule']>, Promise<any>>(
            this,
            (ctx) => {
              const result = cb(ctx)
              if (result instanceof Promise) {
                ++i
                result.finally(() => --i === 0 && r())
              }
              return result
            },
            step,
          )
        },
      }),
    )
  })
