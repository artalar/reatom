---
title: Async validation debounce
description: Debounce and cancel async field validation with Reatom concurrency primitives
---

This recipe implements debounced validation for a field. Thanks to reatom's concurrency mechanism, each new validation call automatically cancels the previous one. The field waits 300ms before making an API request to check if a username is already taken.

```ts
import { reatomField, sleep, abortVar, wrap } from '@reatom/core'

const usernameField = reatomField(
  '',
  {
    validate: async ({ state }) => {
      await wrap(sleep(300))
      const response = await wrap(fetch(`/api/usernames?username=${state}`))
      const { taken } = await wrap(response.json())
      if (taken) return 'This username already taken'
    },
  },
  'usernameField',
)
```
