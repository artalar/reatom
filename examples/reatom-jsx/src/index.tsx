import { connectLogger } from '@reatom/framework'
import { ctx, mount } from '@reatom/jsx'
import { App } from './App'

if (import.meta.env.DEV) {
  connectLogger(ctx)
}

mount(document.getElementById('app')!, <App />)
