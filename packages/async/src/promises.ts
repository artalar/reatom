import { Fn } from '@reatom/core'

export const PROMISES = new WeakMap<
  Promise<any>,
  Fn<[Fn<[], Promise<any>>]>
>()
