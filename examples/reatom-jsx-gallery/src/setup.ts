import { connectLogger } from '@reatom/core'

if (import.meta.env.DEV && !import.meta.env.TEST) {
  connectLogger({ webMcp: { maxEntries: 10e6 } })
}
