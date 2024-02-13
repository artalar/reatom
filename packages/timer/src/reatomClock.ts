import { __count, atom, Atom } from '@reatom/core'
import { onConnect } from '@reatom/hooks'
import { sleep } from '@reatom/utils'

/**
 * Contains latest actual date
 */
export interface ClockAtom extends Atom<Date> {}

export function reatomClock(name?: string): ClockAtom
/**
 * @param optionsOrName {String|Object}
 * @param [optionsOrName.name] {String} Name of a ClockAtom
 * @param [optionsOrName.actualizationInterval] {Number} Interval in milliseconds.
 *  Actualization happens once in interval at best.
 *  Next actualization interval is started after previous actualization.
 */
export function reatomClock(
  optionsOrName:
    | string
    | { name?: string; actualizationInterval?: number } = {},
): ClockAtom {
  const { name = __count('clockAtom'), actualizationInterval = 1000 } =
    typeof optionsOrName === 'string' ? { name: optionsOrName } : optionsOrName

  const forceUpdateAtom = atom(Symbol(), `${name}.forceUpdateAtom`)

  onConnect(forceUpdateAtom, async (ctx) => {
    while (ctx.isConnected()) {
      await sleep(actualizationInterval)
      forceUpdateAtom(ctx, Symbol())
    }
  })

  return atom((ctx) => {
    ctx.spy(forceUpdateAtom)
    return new Date()
  }, `${name}`)
}
