export type Fn<I extends unknown[] = unknown[], O = unknown> = (...a: I) => O
export type Collection<T = unknown> = Record<keyof any, T>

/** Token to stop reactive update propagation */
export const STOP = 'REATOM_STOP_TOKEN'
export type STOP = typeof STOP

export function clearTag<T>(
  value: T,
  // @ts-ignore
): T extends STOP ? undefined : T {
  // @ts-ignore
  if (value !== STOP) return value
}

export const { assign } = Object

export function noop() {}

export function callSafety<Args extends any[]>(fn: Fn<Args>, ...args: Args) {
  try {
    fn(...args)
  } catch (e) {
    console.error(e)
  }
}

/** priority set queue for dynamic topological sorting */
export type Queue<T> = {
  extract: () => T | undefined
  insert: (priority: number, el: T) => void
}
export function Queue<T>(): Queue<T> {
  const parts = new Map<number, T[]>()
  let min = 0
  let max = 0

  return {
    insert(priority: number, el: T) {
      let part = parts.get(priority)
      if (part === undefined) parts.set(priority, (part = []))

      if (part.includes(el) === false) {
        part.push(el)
        min = Math.min(min, priority) // useful only for cycles
        max = Math.max(max, priority)
      }
    },
    extract() {
      let part = parts.get(min)
      while (part === undefined || part.length === 0) {
        if (min !== max) part = parts.get(++min)
        else return
      }
      return part.shift()
    },
  }
}
