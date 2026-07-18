import { log } from '@reatom/core'

declare global {
  var LOG: typeof log
}
globalThis.LOG = log
