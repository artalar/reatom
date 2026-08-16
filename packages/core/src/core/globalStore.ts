export const VERSION = '1001'

export type ReatomGlobal = {
  version: string
  extensions: unknown[]
} & Record<string, unknown>

let runtimeKey: symbol | undefined
let currentRuntime: ReatomGlobal | undefined

let createRuntime = (key?: symbol): ReatomGlobal => {
  let runtime: ReatomGlobal = { version: VERSION, extensions: [] }
  if (key) Object.defineProperty(runtime, key, { value: runtime })
  return runtime
}

/* @__NO_SIDE_EFFECTS__ */
export function ensureReatomGlobal(): ReatomGlobal {
  if (currentRuntime) return currentRuntime

  try {
    let key = (runtimeKey ??= Symbol.for(`@reatom/${VERSION}`))
    let carrier = Object.getOwnPropertyDescriptor(globalThis, key)
    currentRuntime = carrier?.value
    if (
      !currentRuntime ||
      carrier?.configurable ||
      carrier.writable ||
      Object.getOwnPropertyDescriptor(currentRuntime, key)?.value !==
        currentRuntime ||
      currentRuntime.version !== VERSION ||
      !Array.isArray(currentRuntime.extensions) ||
      !Object.isExtensible(currentRuntime) ||
      !Object.isExtensible(currentRuntime.extensions)
    ) {
      currentRuntime = createRuntime(key)
      Object.defineProperty(globalThis, key, {
        configurable: false,
        enumerable: false,
        value: currentRuntime,
        writable: false,
      })
    }
  } catch {
    currentRuntime = createRuntime()
  }

  return currentRuntime
}

/* @__NO_SIDE_EFFECTS__ */
export function _createGlobal<T>(name: string, init: () => T): T {
  let g = ensureReatomGlobal()
  if (Object.hasOwn(g, name)) return (g[name] ??= init()) as T

  let value = init()
  Object.defineProperty(g, name, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
  return value
}
