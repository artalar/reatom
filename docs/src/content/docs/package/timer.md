---
title: timer
description: Reatom for timers
---

Simple timer model to manage some countdown.

```ts
import { reatomTimer } from '@reatom/timer'

// all options are not required, here are the defaults
const pomodoroAtom = reatomTimer({
  name: 'pomodoroAtom',
  interval: 1000, // `1000`ms - tick each second. Than lower, then more precise
  delayMultiplier: 1000, // `1000`ms allow to pass seconds to startTimer. Use `1` to pass ms
  progressPrecision: 2, // progress will be rounded to 2 digits after dot
  resetProgress: true, // progress will be reset to 0 on end of timer
})
```

Example: https://codesandbox.io/s/reatom-react-pomodoro-f219zu?file=/src/App.tsx

```ts
export interface TimerAtom extends AtomMut<number> {
  /** (delay - remains) / delay */
  progressAtom: Atom<number>
  /** interval in ms */
  intervalAtom: AtomMut<number>
  /** start timer by passed interval */
  startTimer: Action<[delay: number], Promise<void>>
  /** stop timer manually */
  stopTimer: Action<[], void>
  /** allow to pause timer */
  pauseAtom: AtomMut<boolean>
  /** switch pause state */
  pause: Action<[], boolean>
  /** track end of timer. Do not call manually! */
  endTimer: Action<[], void>
}
```
