Simple timer model to manage some countdown.

```ts
import { reatomTimer } from '@reatom/timer'

// all options are not required
const pomodoroAtom = reatomTimer({
  name: 'pomodoroAtom',
  interval: 1000, // tick each second
  delayMultiplier: 1000, // allow to pass seconds to startTimer
  progressPrecision: 2, // progress will be rounded to 2 digits after dot
  resetProgress: true, // progress will be reset to 0 on end of timer
})
```

Example: https://stackblitz.com/edit/reatom-timer-pomodoro?file=src%2FApp.tsx

```ts
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
```
