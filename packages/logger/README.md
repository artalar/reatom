Tiny logger with a couple nice configurations.

> included in [@reatom/framework](https://www.reatom.dev/packages/framework)

## Usage

```ts
import { connectLogger, createLogBatched } from '@reatom/logger'

connectLogger(ctx)

// OR

connectLogger(
  ctx,
  // optional configuration
  {
    // `false` by default to made your logs short
    showCause: false,
    // `true` by default to made your logs clear
    skipUnnamed: true,
    // `createLogBatched` by default to not spam you a lot
    // you could pass regular `console.log` here
    log: createLogBatched(
      // optional configuration
      {
        // 20ms by default
        debounce: 20,
        // 5000ms by default, it helps to not stuck with WS and so on
        limit: 5000,
        // `toLocaleTimeString` by default
        getTimeStamp = () => new Date().toLocaleTimeString()

        log: console.log,
      },
    ),
  },
)
```

Every log record includes a number in the start of the name to fix autosorting keys in a console.
