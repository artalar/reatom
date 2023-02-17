import { Action, action, atom, AtomMut, __count } from '@reatom/core'
import { withReducers } from '@reatom/primitives'
import { noop, sleep } from '@reatom/utils'
import { getRootCause, onUpdate } from '@reatom/hooks'

export interface TimerAtom extends AtomMut<number> {
  /** (delay - remains) / delay */
  progressAtom: AtomMut<number>
  /** interval in ms */
  intervalAtom: AtomMut<number> & {
    setSeconds: Action<[seconds: number], number>
  }
  /** start timer by passed interval */
  startTimer: Action<[delay: number], Promise<void>>
  /** allow to pause timer */
  pauseAtom: AtomMut<boolean>
  /** stop timer manually */
  stopTimer: Action<[], void>
  /** track end of timer. Do not call manually! */
  endTimer: Action<[], void>
}

export const reatomTimer = (
  options:
    | string
    | {
        name?: string
        interval?: number
        delayMultiplier?: number
        progressPrecision?: number
      } = {},
): TimerAtom => {
  const {
    name = __count('timerAtom'),
    interval = 1000,
    delayMultiplier = 1000,
    progressPrecision = 2,
  } = typeof options === 'string' ? { name: options } : options
  const progressMultiplier = Math.pow(10, progressPrecision)
  const timerAtom = atom(0, `${name}Atom`)

  const progressAtom: TimerAtom['progressAtom'] = atom(
    0,
    `${name}.progressAtom`,
  )

  const pauseAtom: TimerAtom['pauseAtom'] = atom(false, `${name}.pauseAtom`)

  const intervalAtom: TimerAtom['intervalAtom'] = atom(
    interval,
    `${name}.intervalAtom`,
  ).pipe(
    withReducers({
      setSeconds: (state, seconds: number) => seconds * 1000,
    }),
  )

  const _versionAtom = atom(0, `${name}._versionAtom`)

  const startTimer: TimerAtom['startTimer'] = action((ctx, delay: number) => {
    delay *= delayMultiplier
    const version = _versionAtom(ctx, (s) => s + 1)
    const start = Date.now()
    let target = delay + start
    let remains = delay
    let pause = Promise.resolve()
    let resolvePause = noop

    timerAtom(ctx, remains)

    progressAtom(ctx, 0)

    pauseAtom(ctx, false)

    const cleanupPause = onUpdate(pauseAtom, (pauseCtx, value) =>
      // TODO: circles?
      // getRootCause(ctx.cause) === getRootCause(pauseCtx.cause) &&
      pauseCtx.schedule(() => {
        if (value) {
          const from = Date.now()
          pause = new Promise((resolve) => {
            resolvePause = () => {
              target += Date.now() - from
              resolve()
            }
          })
        } else {
          resolvePause()
        }
      }),
    )

    return ctx
      .schedule(async () => {
        while (remains > 0) {
          await sleep(Math.min(remains, ctx.get(intervalAtom)))
          await pause

          if (version !== ctx.get(_versionAtom)) return

          const batch = ctx.get.bind(ctx)

          batch(() => {
            const interval = ctx.get(intervalAtom)
            remains = timerAtom(ctx, target - Date.now())
            const progress = (delay - remains) / delay
            const roundPart = progress % (interval / delay)
            progressAtom(
              ctx,
              Math.round((progress - roundPart) * progressMultiplier) /
                progressMultiplier,
            )
          })
        }

        endTimer(ctx)
      })
      .finally(cleanupPause)
  }, `${name}.startTimer`)

  const stopTimer: TimerAtom['stopTimer'] = action((ctx) => {
    _versionAtom(ctx, (s) => s + 1)
    endTimer(ctx)
  }, `${name}.stopTimer`)

  const endTimer: TimerAtom['endTimer'] = action((ctx) => {
    timerAtom(ctx, 0)
  }, `${name}.endTimer`)

  return Object.assign(timerAtom, {
    progressAtom,
    endTimer,
    intervalAtom,
    startTimer,
    stopTimer,
    pauseAtom,
  })
}
