---
title: Tooling
description: The list of key tools for Reatom
---

## Logging

Reatom has incredible capabilities for debugging and tracing your code. We will publish our devtools soon, but now you can use `connectLogger` for simple (or not!) logging.

```tsx title="main.tsx"
import './setup' // import setup file before all other modules!
import ReactDOM from 'react-dom/client'
import { App } from './app'

const root = ReactDOM.createRoot(document.getElementById('root')!)
root.render(<App />)
```

For better logging, you can use built-in `log` function, it will forward all arguments to the native `console.log`.

```ts title="setup.ts"
import { connectLogger, log } from '@reatom/core'

if (import.meta.env.MODE === 'development') {
  connectLogger()
}

declare global {
  var LOG: typeof log
}
globalThis.LOG = log
```

You can filter or highlight logs with the `match` option:

```ts title="setup.ts"
connectLogger({
  match: (name, { state }) => {
    // filter unwanted logs
    if (name.includes('internal')) return false

    if (name.includes('error')) {
      // highlight important logs
      return state?.code === 403 ? 'orange' : 'red'
    }

    // pass other logs
    return true
  },
})
```

### Log action

`log` may give you huge DX impact:

- the name is short name and handy
- it will trace the relative call stack and show each time
- **you can put it everywhere** and commit to the source code, logs will not be visible in production
- you can extend it!

`log` is an action, which means you can extend it with `withCallHook` or other action extensions to add custom behavior (e.g., sending logs to a remote service, filtering specific log types, etc.).

```ts
import { withCallHook } from '@reatom/core'

LOG.extend(
  withCallHook((params) => {
    // Send logs to a remote service
    sendToAnalytics({ level: 'debug', args: params })
  }),
)
```

## Vite

[`@reatom/vite`](/reference/vite) injects development HMR cleanup for `reatomRoute` / nested `.reatomRoute()` and for `@reatom/jsx` `mount()`:

```ts title="vite.config.ts"
import { defineConfig } from 'vite'
import { reatom } from '@reatom/vite'

export default defineConfig({
  plugins: [reatom()],
})
```

See [routing HMR](/handbook/routing/#hot-module-replacement-vite) and [JSX HMR](/reference/jsx#hot-module-replacement-vite) for the underlying dispose pattern.

## Eslint

We recommend using ESLint to enforce best practices and coding standards in your Reatom projects. We will publish our own ESLint plugin for name autofix soon, but you can use this plugin right now to automate `action`, `computed`, `effect` naming:

- https://github.com/artalar/eslint-plugin-react-component-name

```json
{
  "plugins": ["react-component-name"],
  "rules": {
    "prefer-arrow-callback": ["error", { "allowNamedFunctions": true }],

    "react-component-name/react-component-name": [
      "error",
      {
        "targets": ["action", "computed", "effect", "reatomComponent"]
      }
    ]
  }
}
```

Additionally to control the use of `wrap` inside `action`, `computed`, and `effect`, you can use this rule. It does not require installing any additional packages and ensures that all promises whose values are retrieved via await are wrapped in wrap.:

```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "CallExpression:matches([callee.name=\"action\"], [callee.name=\"computed\"], [callee.name=\"effect\"]) ArrowFunctionExpression AwaitExpression > :not(CallExpression[callee.name=\"wrap\"])",
        "message": "Any awaited Promise inside \"action\", \"effect\", or \"computed\" must be wrapped with wrap()"
      }
    ]
  }
}
```

## Global Extensions

You can automatically track all Reatom entities (atoms and actions) in your application using global extensions. This is particularly useful for analytics, monitoring, debugging, or logging.

Track user interactions by monitoring action calls:

```ts title="setup.ts"
import { addGlobalExtension, isAction, withCallHook } from '@reatom/core'

addGlobalExtension((target) => {
  if (isAction(target)) {
    target.extend(
      withCallHook((payload, params) => {
        analytics.track('action_called', {
          action: target.name,
          timestamp: Date.now(),
          params: JSON.stringify(params),
        })
      }),
    )
  }
  return target
})
```

Call `addGlobalExtension` early in your application initialization before creating any atoms or actions, as in `connectLogger` example,. Extensions are applied only to entities created after registration.

You can learn more about extensions development in the [Extensions](../handbook/extensions.md) chapter.
