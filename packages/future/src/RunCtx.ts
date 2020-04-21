import { RunCache } from './RunCache'
import { Key } from './types'

/**
 * tiny priority set queue for dynamic topological sorting
 */
export type Queue<T> = {
  extract: () => T | undefined
  insert: (priority: number, el: T) => void
}

export function Queue<T>(): Queue<T> {
  const parts = new Map<number, T[]>()

  let min = 0
  let max = 0
  let next

  return {
    insert(priority: number, el: T) {
      let part = parts.get(priority)

      if (!part) parts.set(priority, (part = []))

      if (!part.includes(el)) {
        part.push(el)

        min = Math.min(min, priority) // useful only for cycles
        max = Math.max(max, priority)
      }
    },

    extract() {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        next = (parts.get(min) || []).shift()

        if (next || min++ >= max) return next
      }
    },
  }
}

export class RunCtx<Context, QueueItem> {
  constructor(ctx: Context) {
    this.ctx = ctx
  }

  ctx: Context

  cache = new Map<Key, RunCache>()

  queue = Queue<QueueItem>()
}
