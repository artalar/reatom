import { Ctx, Fn } from '@reatom/core'

export const allSettled = (ctx: Ctx, cb: Fn<[Ctx]>): Promise<any> =>
  new Promise<void>((r) => {
    let i = 0,
      { schedule } = ctx

    return cb(
      (ctx = {
        ...ctx,
        // @ts-expect-error bad call type inference for generic
        schedule(cb, isNearEffect) {
          return schedule.call(
            this,
            (ctx) => {
              const result = cb(ctx)
              if (result instanceof Promise) {
                ++i
                result.finally(() => --i === 0 && r())
              }
              return result
            },
            isNearEffect,
          )
        },
      }),
    )
  })
