Timer model to manage some countdown. Useful for [classic pomodoro](https://github.com/artalar/reatom/tree/v3/examples/react-pomodoro) or any time-progress states, like [notifications](https://github.com/artalar/reatom/tree/v3/examples/react-notifications).

## reatomTimer

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

The timer itself contains the ms remaining to the end of the timer (`0` before start). Here is the list of available states and methods:

- **progressAtom** (`Atom<number>`) - from 0 to 1, `(delay - remains) / delay`
- **intervalAtom** (`AtomMut<number>`) - interval of ticks in ms
- **startTimer** (`Action<[delay: number, passed?: number], Promise<void>>`) - start timer with the delay and optional start point
- **stopTimer** (`Action<[], void>`) - stop timer manually
- **pauseAtom** (`AtomMut<boolean>`) - allow to pause timer
- **pause** (`Action<[], boolean>`) - switch pause state
- **endTimer** (`Action<[], void>`) - track end of timer. Do not call manually!

### Examples

- [classic pomodoro](https://github.com/artalar/reatom/tree/v3/examples/react-pomodoro)
- [notifications progress](https://github.com/artalar/reatom/tree/v3/examples/react-notifications)

## reatomClock

Reatom clock actualizes date once in a specified interval.
You can spy on it to implement absolute time based logic.

```ts
import { reatomClock } from '@reatom/timer'

// Atom stores and updates time once in a second by default
const nowAtom = reatomClock('nowAtom')

// Atom is updates once in a minute
const eventuallyAtom = reatomClock({
  name: 'eventuallyAtom',
  actualizationInterval: 60_000,
})

const RELEASE_DATE = new Date('2024-11-12T15:20+00')
const showCongratulationsBannerAtom = atom(
  (ctx) => ctx.spy(eventuallyAtom) >= RELEASE_DATE,
  'showCongratulationsBannerAtom',
)
```
