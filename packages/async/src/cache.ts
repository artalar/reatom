import { Fn } from '@reatom/core'

export const CACHE = new WeakMap<
  Promise<any>,
  Fn<[Fn<[], Promise<any>>]>
>()
