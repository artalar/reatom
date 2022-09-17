import { Ctx, Fn } from '@reatom/core'

interface ControlledContext extends Ctx {
  disable: Fn<[]>
}

export class DisabledError extends Error {
  constructor() {
    super('Reatom error: access to disabled context branch')
  }
}

export const controlContext = (ctx: Ctx): ControlledContext => {
  const controlledContext = {} as ControlledContext
  let isDisabled = false

  for (const prop in ctx) {
    // @ts-expect-error stupid TS
    const value = (controlledContext[prop] = ctx[prop])

    if (typeof value === 'function') {
      Object.assign(controlledContext, {
        [prop](...a: Array<any>) {
          if (isDisabled) throw new DisabledError()

          if (prop === 'schedule') {
            const [effect] = a
            a[0] = (...a: Array<any>) => {
              try {
                var promise = Promise.resolve(effect(...a))
              } catch (error) {
                promise = Promise.reject(error)
              }

              return promise.finally(() => {
                // stack it forever
                if (isDisabled) return new Promise(() => {})
              })
            }
          }

          return value.apply(this, a)
        },
      })
    }
  }

  Object.assign(controlledContext, {
    disable() {
      isDisabled = true
    },
  })

  return controlledContext
}

// export const take
