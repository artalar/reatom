import { Action, action, atom, AtomMut } from '@reatom/core'
import { withReducers } from '@reatom/primitives'
import { sleep } from '@reatom/utils'

export interface TimerAtom extends AtomMut<number> {
  intervalAtom: AtomMut<number> & {
    setSeconds: Action<[seconds: number], number>
  }
  startTimer: Action<[delayInSeconds: number], Promise<void>>
  stopTimer: Action<[], void>
}

export const atomizeTimer = (name: string): TimerAtom => {
  const timerAtom = atom(0, `${name}Atom`)

  const intervalAtom = atom(1000, `${name}IntervalAtom`).pipe(
    withReducers({
      setSeconds: (state, seconds: number) => seconds * 1000,
    }),
  )

  const versionAtom = atom(0)

  const startTimer = action((ctx, delayInSeconds: number) => {
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

      timerAtom(ctx, 0)
    })
  }, `${name}.start`)

  const stopTimer = action((ctx) => {
    versionAtom(ctx, (s) => s + 1)
    timerAtom(ctx, 0)
  }, `${name}.stop`)

  return Object.assign(timerAtom, {
    intervalAtom,
    startTimer,
    stopTimer,
  })
}
