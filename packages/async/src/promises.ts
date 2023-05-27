

export const PROMISES = new WeakMap<
  Promise<any>,
  (fn: () => Promise<any>) => any
>()
