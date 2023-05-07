export const CACHE = new WeakMap<
  Promise<any>,
  (fn: () => Promise<any>) => any
>()
