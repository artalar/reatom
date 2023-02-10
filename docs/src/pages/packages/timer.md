---
layout: ../../layouts/Layout.astro
title: timer
description: Reatom for timer
---

Simple timer model to manage some countdown.

```ts
import { reatomTimer } from '@reatom/timer'

const timer = reatomTimer({ interval: 1000 })
```

```ts
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
```
