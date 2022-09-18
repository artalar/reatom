---
layout: ../../layouts/Layout.astro
title: timer
description: Reatom for timer
---  

There is no docs yet, but you could check tests instead:
```ts
import { test } from 'uvu'
import * as assert from 'uvu/assert'
import { createCtx } from '@reatom/core'
import { getDuration } from '@reatom/testing'
import { sleep } from '@reatom/utils'

import { reatomTimer } from './'

test(`base API`, async () => {
  const timerModel = reatomTimer(`test`)
  const ctx = createCtx()

  timerModel.intervalAtom.setSeconds(ctx, 0.001)

  var target = 50
  var duration = await getDuration(() =>
    timerModel.startTimer(ctx, target / 1000),
  )

  assert.ok(duration >= target)

  var target = 50
  var [duration] = await Promise.all([
    getDuration(() => timerModel.startTimer(ctx, target / 1000)),
    sleep(target / 2).then(() => timerModel.stopTimer(ctx)),
  ])
  assert.ok(duration >= target / 2 && duration < target)
  ;`👍` //?
})

test.run()

```
