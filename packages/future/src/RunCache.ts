import { assign, getKind } from './shared'
import { Kind, Rollback } from './types'

export class RunCache<T = unknown> {
  readonly value!: T

  readonly kind!: Kind

  readonly rollback?: Rollback

  constructor(opts: { value: T; kind?: Kind; rollback?: Rollback }) {
    const { value, kind = getKind(value), rollback } = opts

    assign(this, { value, kind, rollback })
  }
}
