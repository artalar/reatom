import { STOP } from './constants'
import { Fn, Kind } from './types'

export const { assign } = Object

export function getIsString(thing: any): thing is string {
  return typeof thing === 'string'
}

export function getIsFunction(thing: any): thing is Fn {
  return typeof thing === 'function'
}

export function callSafety<Args extends any[]>(fn: Fn<Args>, ...args: Args) {
  try {
    fn(...args)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
  }
}

// FIXME: replace to `asserts`
export function invalid<T extends boolean>(
  condition: T,
  msg: string,
): T extends true ? void : never
export function invalid(condition: boolean, msg: string): never | void {
  if (condition) throw new Error(`Reatom: invalid ${msg}`)
}

export function getKind(value: any): Kind {
  // eslint-disable-next-line no-nested-ternary
  return value === STOP
    ? 'stop'
    : value instanceof Promise
    ? 'async'
    : 'payload'
}
