import { Action, action, atom, AtomMut, __count } from '@reatom/core'
import { withReducers } from '@reatom/primitives'
import { sleep } from '@reatom/utils'

export interface TimerAtom extends AtomMut<number> {
  /** interval in ms */
  intervalAtom: AtomMut<number> & {
    setSeconds: Action<[seconds: number], number>
  }
  /** start timer by passed interval */
  startTimer: Action<[delayInSeconds: number], Promise<void>>
  /** stop timer manually */
  stopTimer: Action<[], void>
  /** track end of timer, do not call manually */
  endTimer: Action<[], void>
  /** track every interval tick, do not call manually */
  tick: Action<[remains: number], number>
}

export const reatomTimer = (
  options: string | { name?: string; interval?: number } = {},
): TimerAtom => {
  const { name = __count('timerAtom'), interval = 1000 } =
    typeof options === 'string' ? { name: options } : options
  const timerAtom = atom(0, `${name}Atom`)

  const intervalAtom: TimerAtom['intervalAtom'] = atom(
    interval,
    `${name}.intervalAtom`,
  ).pipe(
    withReducers({
      setSeconds: (state, seconds: number) => seconds * 1000,
    }),
  )

  const _versionAtom = atom(0, `${name}._versionAtom`)

  const tick: TimerAtom['tick'] = action(
    (ctx, remains) => remains,
    `${name}.tick`,
  )

  const startTimer: TimerAtom['startTimer'] = action(
    (ctx, delayInSeconds: number) => {
      const version = _versionAtom(ctx, (s) => s + 1)
      const delay = delayInSeconds * 1000
      const start = Date.now()
      const target = delay + start
      let remains = delay

      timerAtom(ctx, remains)

      return ctx.schedule(async () => {
        while (remains > 0) {
          await sleep(Math.min(remains, ctx.get(intervalAtom)))

          if (version !== ctx.get(_versionAtom)) return

          remains = timerAtom(ctx, target - Date.now())
          tick(ctx, remains)
        }

        endTimer(ctx)
      })
    },
    `${name}.startTimer`,
  )

  const stopTimer: TimerAtom['stopTimer'] = action((ctx) => {
    _versionAtom(ctx, (s) => s + 1)
    endTimer(ctx)
  }, `${name}.stopTimer`)

  const endTimer: TimerAtom['endTimer'] = action((ctx) => {
    timerAtom(ctx, 0)
  }, `${name}.endTimer`)

  return Object.assign(timerAtom, {
    endTimer,
    intervalAtom,
    startTimer,
    stopTimer,
    tick,
  })
}
