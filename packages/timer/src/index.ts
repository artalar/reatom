import { Action, action, atom, AtomMut } from '@reatom/core'
import { withReducers } from '@reatom/primitives'
import { sleep } from '@reatom/utils'

export interface TimerAtom extends AtomMut<number> {
  // interval in ms
  intervalAtom: AtomMut<number> & {
    setSeconds: Action<[seconds: number], number>
  }
  // start timer by passed interval
  startTimer: Action<[delayInSeconds: number], Promise<void>>
  // stop timer manually
  stopTimer: Action<[], void>
  // track end of timer, do not call manually
  endTimer: Action<[], void>
}

export const reatomTimer = (name: string): TimerAtom => {
  const timerAtom = atom(0, `${name}Atom`)

  const intervalAtom: TimerAtom['intervalAtom'] = atom(
    1000,
    `${name}IntervalAtom`,
  ).pipe(
    withReducers({
      setSeconds: (state, seconds: number) => seconds * 1000,
    }),
  )

  const versionAtom = atom(0)

  const startTimer: TimerAtom['startTimer'] = action(
    (ctx, delayInSeconds: number) => {
      const version = versionAtom(ctx, (s) => s + 1)
      const delay = delayInSeconds * 1000
      const start = Date.now()
      const target = delay + start
      let remains = delay

      timerAtom(ctx, remains)

      return ctx.schedule(async () => {
        while (remains > 0) {
          await sleep(Math.min(remains, ctx.get(intervalAtom)))

          if (version !== ctx.get(versionAtom)) return

          timerAtom(ctx, (remains = target - Date.now()))
        }

        endTimer(ctx)
      })
    },
    `${name}.start`,
  )

  const stopTimer: TimerAtom['stopTimer'] = action((ctx) => {
    versionAtom(ctx, (s) => s + 1)
    endTimer(ctx)
  }, `${name}.stop`)

  const endTimer: TimerAtom['endTimer'] = action((ctx) => {
    timerAtom(ctx, 0)
  }, `${name}.end`)

  return Object.assign(timerAtom, {
    endTimer,
    intervalAtom,
    startTimer,
    stopTimer,
  })
}
