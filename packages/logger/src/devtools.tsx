import { Ctx } from '@reatom/core'
import { noop } from '@reatom/utils'

export function devtoolsCreate(ctx: Ctx) {
  if (typeof window === 'undefined') {
    return noop
  }

  return () => {}
}
