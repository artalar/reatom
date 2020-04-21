import { STOP } from './constants'
import { createSomeFuture } from './createSomeFuture'
import { Future, getInternal } from './Future'
import { RunCache } from './RunCache'
import { FnI, FnO } from './types'

export type CombineDeps =
  | Record<string, Future<any, any>>
  | [Future<any, any>]
  | Future<any, any>[]

export type CombineDepsI<Deps extends CombineDeps> = {
  [K in keyof Deps]: FnI<Deps[K]> | STOP
}

export type CombineDepsO<Deps extends CombineDeps> = {
  [K in keyof Deps]: FnO<Deps[K]> | STOP
}

export function futureCombine<Deps extends CombineDeps>(
  deps: Deps,
): Future<CombineDepsI<Deps>, CombineDepsO<Deps>> {
  const depsNames = Object.keys(deps)

  const depsCount = depsNames.length
  const isDepsAreArray = Array.isArray(deps)

  return createSomeFuture({
    name: JSON.stringify(deps),

    deps: depsNames.map(name => (deps as any)[name]),

    lift: (input, runCtx) => {
      return depsNames.map(name => {
        return getInternal((deps as any)[name])._lift(
          (input as any)[name],
          runCtx,
        )
      })
    },

    executor: inputs => {
      const result: any = isDepsAreArray ? new Array(depsCount) : {}

      let isError = false
      depsNames.forEach((depName, i) => {
        const depPayload = inputs[i]

        isError = isError || depPayload.kind === 'error'

        result[depName] = depPayload.value
      })

      return isError
        ? new RunCache({ value: result, kind: 'error' })
        : new RunCache({ value: result })
    },
  }) as Future<CombineDepsI<Deps>, CombineDepsO<Deps>>
}
