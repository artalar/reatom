import { Action, action, Atom, atom, AtomMut } from '@reatom/core'
import { withReducers } from '@reatom/primitives'
import { sleep } from '@reatom/utils'

// TODO
export interface TimerModel {
  timerAtom: AtomMut<number>
  intervalAtom: AtomMut<number> & {
    setSeconds: Action<[seconds: number], number>
  }
  startTimer: Action<[delayInSeconds: number], Promise<void>>
  stopTimer: Action<[], void>
}

export const atomizeTimer = (name: string): TimerModel => {
  const timerAtom = atom(0, `${name}Timer`)

  const intervalAtom = atom(1000, `${name}TimerInterval`).pipe(
    withReducers({
      setSeconds: (state, seconds: number) => seconds * 1000,
    }),
  )

  const versionAtom = atom(0, `${name}TimerVersion`)

  const startTimer = action(async (ctx, delayInSeconds: number) => {
    const version = versionAtom(ctx, (s) => s + 1)
    const delay = delayInSeconds * 1000
    const start = Date.now()
    const target = delay + start
    let remains = delay

    timerAtom(ctx, remains)

    await ctx.schedule()

    while (remains > 0) {
      await sleep(Math.min(remains, ctx.get(intervalAtom)))

      if (version !== ctx.get(versionAtom)) return

      timerAtom(ctx, (remains = target - Date.now()))
    }

    timerAtom(ctx, 0)
  }, `${name}StartTimer`)

  const stopTimer = action((ctx) => {
    versionAtom(ctx, (s) => s + 1)
    timerAtom(ctx, 0)
  }, `${name}StopTimer`)

  return {
    timerAtom,
    intervalAtom,
    startTimer,
    stopTimer,
  }
}
